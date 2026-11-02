import { createContext, tick } from 'svelte'
import {
	buildTree, flatten, refOf, toggleBlock, toggleChild, setType, setDateInput, initStarts, validateBlocks,
	removeAllBlocks, resetToAnalysis, removePage, shiftStructures, toSaveRequest, clonePages, siblingsFrom, syncDateInputs,
	canMerge, makeLoose, shiftIndex,
} from './logic/blocks.mjs'
import { initLabels } from './logic/pagination.mjs'
import { restoreFromMets, simulateRules, sameSettings, acceptOffers } from './logic/pagination-tools.mjs'
import { detectStrategies, restructure, afterTyping, applyStrategy, strategyOptions, nodeKey } from './logic/strategies.mjs'
import { previewLabel, ownNumberingAll } from './logic/typing.mjs'
import { parseLabel, isCounting } from './logic/labels.mjs'
import { applyTypePattern } from './logic/generation.mjs'
import { fieldStates, initFieldStates, keepFieldValue, resetFieldValue, setFieldValue } from './logic/fields.mjs'
import { savedState, unsavedChanges } from './logic/unsaved.mjs'
import { positionColor } from './logic/colors.mjs'
import { flash } from './flash'
import { FacesBridge } from './faces-bridge.js'
import { ThumbnailLoader } from './thumbnails.svelte'
import { findConflicts, applyResolution, upsertOperation, hasHidden, explicitConflict } from './logic/hidden.mjs'
import type { Baseline, Unsaved, BlockFlags, Catalog, BlockNode, BlockRef, ChangeOptions, Confirmation, DialogState, FieldState, FreshOffer, Hidden, LabelMode, LabelPreview, Notice, Offer, Operation, Page, PaginationSettings, PendingChange, PluginProps, Problem, Row, RulesScope, StrategyOf, StrategyOption, Tree, TypeOption, Validation } from '../types';

/** the problems that validation reports, with the key of their summary text */
const PROBLEMS: [Problem, string][] = [
	['missingType', 'missingType'],
	['notAllowed', 'notAllowed'],
	['invalidDate', 'invalidDate'],
	['missingRequired', 'missingRequired'],
	['duplicates', 'duplicates'],
]

export const [getApp, setApp] = createContext() as [() => Recognizer, (app: Recognizer) => Recognizer, () => boolean]

const PREFIX = 'plugin_newspaperRecognizer_'

/**
 * The state and the actions of the plugin page: pages, blocks, validation, dialogs and the bridge to the JSF forms.
 *
 * The pure logic lives in ./logic; this class only owns what changes. The page list is mutated in place by some actions (a typed
 * date, a field value) and then replaced by a copy (touch), so everything that reads from it is re-evaluated.
 * The options are described in plugin_newspaperRecognizer.xhtml.
 */
export class Recognizer {
	// the options of the page, read once
	readonly props: PluginProps
	readonly bridge: FacesBridge
	readonly thumbHeight: number
	readonly loadAllImages: boolean
	readonly thumbnails = new ThumbnailLoader()
	readonly showDeletePageButton: boolean
	readonly dateFormatPattern: string
	readonly volumeType: string
	readonly preventDuplicates: boolean
	readonly configErrors: string[]
	readonly title: string
	readonly catalog: Catalog

	// messages
	msgs: Record<string, string> = $state.raw(({} as Record<string, string>))
	msgsLoaded = $state(false)

	// data
	pages: Page[] = $state.raw([])
	notices: Notice[] = $state.raw([])
	volumeHidden: Hidden = $state.raw({ structures: [], metadata: [] })
	offers: Offer[] = $state.raw([]) // {first, pages, signature}: blocks that offer "Neu nach Regeln"
	dismissedOffers: Map<number, string | null> = $state.raw(new Map()) // first page of a dismissed block → its signature at dismissal
	// the offers a deleted image created, by file name of the first page of their block: restored after the save that follows the deletion
	offersAcrossSave: { file: string, offer: Offer }[] = []
	preview: LabelPreview | null = $state.raw(null) // {index, text, mode, result}: the label being typed
	settings: PaginationSettings = $state.raw(({} as PaginationSettings))
	// the entries picked in the session, by file name of the first page and level of the node; kept across the reload after saving
	chosen: Map<string, string> = $state.raw(new Map())
	// the pagination strategy of every node by node key, read from the labels in commit and loadData (a touch changes no label or structure)
	strategies: Map<string, string> = $state.raw(new Map())

	// derived from the pages by refresh()
	tree: Tree = $state.raw({ roots: [], loose: [] })
	validation: Validation = $state.raw({ valid: true, missingType: [], notAllowed: [], invalidDate: [], missingRequired: [], duplicates: [] })
	flags: Record<string, BlockFlags> = $state.raw({})
	rows: Row[] = $state.raw([])
	ownFlags: (string | null)[] = $state.raw([]) // per page the follow value of own numbering, else null

	// session
	saveInFlight = $state(false) // true while a save request is on its way; blocks everything that would abort it
	ajaxBusy = $state(false)
	actionsOpen = $state(false)
	confirmation: Confirmation | null = $state.raw(null) // {title, text, button, action, icon, params}
	openHidden: string | null = $state(null) // element id of the block whose hidden data is listed, or 'volume'
	pendingChange: PendingChange | null = $state.raw(null) // a change waiting for the user's decision about hidden data
	dialog: DialogState | null = $state.raw(null) // {kind: 'pattern' | 'continue' | 'rules', ...}

	// plain fields
	pendingExit = false // set by saveAndLeave, acted upon once the backend confirms the write
	pointerDown = false
	operations: Operation[] = $state.raw([])
	hiddenCursor = -1
	offerCursor = -1
	unsavedCursor = -1
	noticesOpen = $state(false) // the section "Hinweise" is collapsed at every opening of the plugin
	problemCursor: Record<string, number> = {}
	// the element of the app, set by App.svelte before anything uses it
	root: HTMLElement = (null as any)

	hiddenBlocks = $derived(flatten(this.tree.roots).filter(node => hasHidden(node.start)))
	showOffersBanner = $derived(this.settings.enabled && this.offers.length >= 2)
	offersPageCount = $derived(this.offers.reduce((sum, offer) => sum + offer.pages.length, 0))
	// the notice about structures of the volume is part of the additional data notice
	otherNotices = $derived(this.notices.filter(n => n.key !== PREFIX + 'notice_volumeHidden'))
	hasOpenEdit = $derived(!!this.preview && this.preview.result.pages.some((page, i) => page.label !== this.pages[i].label))
	// what differs from the last loaded or saved state: the baseline is taken in loadData, so a save that was not written leaves it unsaved
	baseline: Baseline = $state.raw({ blocks: new Map(), files: [], volumeStructures: 0 })
	unsaved: Unsaved = $derived.by(() => unsavedChanges(this.baseline, this.pages, this.catalog, this.operations, this.volumeHidden))
	typingPending = $state(false) // a date, number, prefix or suffix is being typed and not yet applied; saving stays possible meanwhile
	hasUnsaved = $derived(this.unsaved.any || this.hasOpenEdit || this.typingPending)
	saveBlocked = $derived.by(() => this.configErrors.length > 0 || !this.validation.valid)
	saveBlockedOpen = $state(false) // the summary of what keeps the data from being saved
	saveBlockedLeave = $state(false) // the summary was opened by the leave button: it offers "leave anyway"
	leaveOpen = $state(false) // the question whether to save or discard the unsaved changes before leaving
	canSave = $derived(!this.saveInFlight && this.hasUnsaved && !this.saveBlocked)
	validationProblems = $derived(PROBLEMS.filter(([name]) => this.validation[name].length > 0)
		.map(([name, key]) => ({ name, key: `${PREFIX}validation_summary_${key}`, count: new Set(this.validation[name].map(ref => `${ref.page}:${ref.level}`)).size })))

	constructor(props: PluginProps, bridge: FacesBridge = new FacesBridge(props)) {
		this.props = props
		this.bridge = bridge
		this.thumbHeight = props.thumbHeight
		this.loadAllImages = props.loadallimages
		this.showDeletePageButton = props.showDeletePageButton
		this.dateFormatPattern = props.dateFormatPattern
		this.volumeType = props.volumeType
		this.preventDuplicates = props.preventDuplicates
		this.configErrors = [...new Set(props.configErrors || [])]
		this.title = props.title
		this.catalog = Object.fromEntries((props.typeCatalog || []).map(type => [type.name, type]))
		const pagination = props.pagination
		this.settings = {
			enabled: !!(pagination && pagination.enabled),
			automatic: !pagination || pagination.automatic !== false,
			countThroughVolume: !!(pagination && pagination.countThroughVolume),
			withoutBlock: pagination && pagination.withoutBlock && pagination.withoutBlock.length ? pagination.withoutBlock : ['–'],
			rules: (pagination && pagination.rules) || {},
		}
		this.loadData(bridge.readData())
	}

	// ---- messages

	t: (key: string) => string = key => (key in this.msgs ? this.msgs[key] : key)

	fmt: (key: string, ...args: any[]) => string = (key, ...args) => this.t(key).replace(/\{(\d+)\}/g, (match, i) => (args[i] !== undefined ? args[i] : match))

	formatNotice(notice: Notice) {
		return this.t(notice.key).replace(/\{(\d+)\}/g, (match, i) => (notice.params && notice.params[i] !== undefined ? notice.params[i] : match))
	}

	/** the texts of the page; when they cannot be loaded the page works with the keys instead of a dead placeholder (t returns the key of an unknown text) */
	async loadMessages() {
		try {
			let path = window.location.pathname
			path = path.substring(0, path.indexOf('/uii/'))
			const response = await fetch(`${path}/api/messages/${this.props.language}`, { method: 'GET', credentials: 'same-origin' })
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`)
			}
			const json = await response.json()
			const msgs: Record<string, string> = {}
			for (const key of Object.keys(json)) {
				msgs[key] = json[key].replace(' zzz', '')
			}
			this.msgs = msgs
		} catch (error) {
			console.error('newspaper recognizer: the texts could not be loaded, the page shows their keys', error)
		}
		this.msgsLoaded = true
	}

	// ---- loading and deriving

	/* replace the whole state with what the backend sent */
	loadData(data: { pages?: Page[], notices?: Notice[], volumeHidden?: Hidden }) {
		const pages = data.pages || []
		this.notices = data.notices || []
		this.volumeHidden = data.volumeHidden || { structures: [], metadata: [] }
		this.operations = []
		for (const page of pages) {
			if (page.image) {
				page.image.thumbnailUrl = toSameOriginUrl(page.image.thumbnailUrl)
				page.image.largeThumbnailUrl = toSameOriginUrl(page.image.largeThumbnailUrl)
			}
		}
		initStarts(pages, this.dateFormatPattern)
		initFieldStates(pages, this.catalog)
		initLabels(pages)
		this.baseline = savedState(pages, this.catalog, this.volumeHidden)
		this.typingPending = false
		this.pages = pages
		this.strategies = this.detect()
		this.clearOffers()
		this.preview = null
		this.refresh()
	}

	refresh() {
		this.tree = buildTree(this.pages)
		this.validation = validateBlocks(this.pages, this.catalog, this.volumeType, this.preventDuplicates)
		this.flags = this.indexFlags(this.validation)
		this.rows = this.buildRows(this.tree)
		this.ownFlags = this.settings.enabled ? ownNumberingAll(this.pages, this.settings, this.strategyOfKey) : []
	}

	/* after an in-place change of a page: a copy of the page list makes everything that reads from it update */
	touch() {
		this.typingPending = false
		this.pages = clonePages(this.pages)
		this.refresh()
	}

	/** level-0 blocks and runs of pages without structure, in page order */
	buildRows(tree: Tree): Row[] {
		const rows: Row[] = []
		let next = 0
		for (let i = 0; i < this.pages.length;) {
			const root = tree.roots[next]
			if (root && root.first === i) {
				rows.push({ loose: false, key: 'block-' + root.first, node: root })
				i = root.last + 1
				next++
			} else {
				const run = []
				while (i < this.pages.length && !(tree.roots[next] && tree.roots[next].first === i)) {
					run.push(i++)
				}
				rows.push({ loose: true, key: 'loose-' + run[0], pages: run })
			}
		}
		return rows
	}

	indexFlags(validation: Validation): Record<string, BlockFlags> {
		const flags: Record<string, BlockFlags> = {}
		const mark: (refs: BlockRef[], name: keyof BlockFlags) => void = (refs, name) => refs.forEach(ref => {
			const key = `${ref.page}:${ref.level}`
			flags[key] = flags[key] || {}
			flags[key][name] = true
		})
		mark(validation.missingType, 'missingType')
		mark(validation.notAllowed, 'notAllowed')
		mark(validation.invalidDate, 'invalidDate')
		mark(validation.missingRequired, 'missingRequired')
		mark(validation.duplicates, 'duplicate')
		return flags
	}

	// ---- reading helpers for the templates

	flagsFor(node: BlockNode): BlockFlags {
		const flags = { ...(this.flags[`${node.first}:${node.level}`] || {}) }
		const info = this.catalog[node.start.type ?? ''] || {}
		flags.missingDate = flags.missingRequired && info.dated && info.dateRequired && !node.start.date && !node.start.dateRaw
		flags.missingNumber = flags.missingRequired && info.numbered && info.numberRequired && !(node.start.number || '').trim()
		return flags
	}

	fieldsOf(node: BlockNode): FieldState[] {
		return fieldStates(node, this.catalog)
	}

	typeOptions(parentType: string | null): TypeOption[] {
		return ((this.catalog[parentType ?? ''] || {}).children || []).map(name => ({ name, label: (this.catalog[name] || {}).label || name }))
	}

	typeLabel: (type: string | null) => string = type => (type ? (this.catalog[type] || {}).label || type : this.t(PREFIX + 'pleaseSelect'))

	childColor(number: number) {
		return positionColor(number - 1)
	}

	blockElementId(node: { first: number, level: number }) {
		return `block-${node.first}-${node.level}`
	}

	/** the pages of a block after its first page, with the number of the child block they belong to (0 = none) */
	pagesOf(node: BlockNode) {
		const result = []
		for (let i = node.first + 1; i <= node.last; i++) {
			const child = node.children.findIndex(c => c.first <= i && i <= c.last)
			result.push({ index: i, child: child + 1 })
		}
		return result
	}

	pagesSummary(first: number, last: number) {
		if (first === last) {
			return this.fmt(PREFIX + 'pagesSummarySingle', first)
		}
		return this.fmt(PREFIX + 'pagesSummary', last - first + 1, first, last)
	}

	/** "Seite 5", "Seiten 5–6, 9" from page indexes */
	pagesText(indexes: number[]) {
		const ranges = []
		for (const i of indexes) {
			const last = ranges[ranges.length - 1]
			if (last && last[1] === i - 1) {
				last[1] = i
			} else {
				ranges.push([i, i])
			}
		}
		const text = ranges.map(([from, to]) => (from === to ? `${from + 1}` : `${from + 1}–${to + 1}`)).join(', ')
		return this.fmt(indexes.length === 1 ? PREFIX + 'pagination_pageOne' : PREFIX + 'pagination_pagesMany', text)
	}

	isGeneratable(node: BlockNode) {
		const info = this.catalog[node.start.type ?? ''] || {}
		return !!(info.dated || info.numbered)
	}

	/* the types of the drop-downs of the volume (its own types first, then their children) in ruleset order */
	ruleTypes() {
		const types: string[] = []
		const queue = [this.volumeType]
		while (queue.length > 0) {
			for (const name of ((this.catalog[queue.shift() ?? ''] || {}).children || [])) {
				if (!types.includes(name)) {
					types.push(name)
					queue.push(name)
				}
			}
		}
		return types
	}

	// ---- the single entry point for every change of the page list

	/** asks about hidden data before committing */
	applyChange(newPages: Page[], options: ChangeOptions = {}) {
		if (this.sameState(this.pages, newPages)) {
			return // nothing changed: no dirty state
		}
		const conflicts = findConflicts(this.pages, newPages, this.catalog, this.volumeType)
		if (conflicts.length === 0) {
			const fresh = this.commit(newPages, options)
			if (options.afterCommit) {
				options.afterCommit(fresh)
			}
			return
		}
		this.pendingChange = { pages: newPages, conflicts, options }
	}

	sameState(before: Page[], after: Page[]) {
		const plain = (pages: Page[]) => JSON.stringify(pages.map(({ depth, label, starts }) => [depth, label, starts]))
		return before.length === after.length && plain(before) === plain(after)
	}

	/**
	 * a structure change relabels its blocks by their strategies (unless options.paginate is false, then options.offers are its offers);
	 * returns the offers of this change
	 */
	commit(newPages: Page[], options: ChangeOptions = {}): FreshOffer[] {
		let pages = newPages
		let offers: FreshOffer[] = options.offers ?? []
		if (this.settings.enabled && options.paginate !== false) {
			const result = restructure(this.pages, newPages, this.settings, this.chosen, this.strategies)
			pages = result.pages
			offers = result.offers
		}
		if (options.removed !== undefined) {
			const removed = options.removed
			this.offers = this.offers.map(offer => ({ ...offer, first: shiftIndex(offer.first, removed),
				pages: offer.pages.filter(i => i !== removed).map(i => shiftIndex(i, removed)) }))
			this.dismissedOffers = new Map([...this.dismissedOffers].map(([first, signature]) => [shiftIndex(first, removed), signature]))
		}
		this.pages = pages
		this.strategies = this.detect()
		this.refresh()
		this.updateOffers(offers)
		return offers
	}

	resolveConflicts(choices: Record<string, string>) {
		const { pages, conflicts, options } = (this.pendingChange as PendingChange)
		this.pendingChange = null
		const additions = []
		for (const conflict of conflicts) {
			const action = choices[conflict.kind]
			const { volumeAdditions } = applyResolution(pages, conflict, action, this.catalog, this.volumeType)
			additions.push(...volumeAdditions)
			this.operations = upsertOperation(this.operations, conflict.blockId, conflict.kind, action)
		}
		this.volumeHidden = { ...this.volumeHidden, structures: [...this.volumeHidden.structures, ...additions] }
		const fresh = this.commit(pages, options)
		if (options.afterCommit) {
			options.afterCommit(fresh)
		}
	}

	cancelConflicts() {
		this.pendingChange = null
	}

	// ---- offers of "Neu nach Regeln"

	clearOffers() {
		this.offers = []
		this.dismissedOffers = new Map()
	}

	/**
	 * The open offers after a change, per block: the fresh ones of the change and the earlier ones whose block is as it was (keepOffers). A
	 * dismissed offer stays hidden, also as a fresh one, until its block changes.
	 */
	updateOffers(fresh: FreshOffer[]) {
		const dismissed = new Map([...this.dismissedOffers].filter(([first, signature]) => signature === this.offerSignature(first)))
		this.dismissedOffers = dismissed
		this.offers = this.keepOffers(fresh.filter(offer => !dismissed.has(offer.first)))
	}

	/**
	 * an offer belongs to its block as it is: another structure change, child type or label in the block makes it disappear; a page removed
	 * before it does not. An offer over pages up to to (a typed label's offer spans the blocks continuing it) also belongs to the blocks up
	 * to the one of that page.
	 */
	offerSignature(first: number, to = first) {
		const node = this.tree.roots.find(root => root.first === first)
		if (!node) {
			return null
		}
		const last = Math.max(node.last, this.tree.roots.find(root => root.first <= to && to <= root.last)?.last ?? node.last)
		return JSON.stringify([last - node.first, node.start.type,
			this.pages.slice(node.first, last + 1).map(page => [page.label, page.depth, page.starts.map(start => start.type)])])
	}

	/** offerSignature of an offer, over every block of its pages */
	signatureOf(offer: FreshOffer) {
		return this.offerSignature(offer.first, offer.pages.at(-1) ?? offer.first)
	}

	/** offers kept across a reload (offersAcrossSave): each one whose block still starts on its file and is as it was */
	restoreOffers(kept: { file: string, offer: Offer }[]) {
		const offers = kept.flatMap(({ file, offer }) => {
			const first = this.pages.findIndex(page => page.filename === file)
			const moved = { ...offer, first, pages: offer.pages.map(i => i + first - offer.first) }
			return first >= 0 && this.signatureOf(moved) === offer.signature ? [moved] : []
		})
		if (offers.length) {
			this.offers = [...this.offers, ...offers]
		}
	}

	keepOffers(fresh: FreshOffer[]) {
		const offers = fresh.map(offer => ({ ...offer, signature: this.signatureOf(offer) }))
		for (const offer of this.offers) {
			if (!offers.some(o => o.first === offer.first) && offer.signature === this.signatureOf(offer)) {
				offers.push(offer)
			}
		}
		return offers
	}

	offerFor(row: Row): Offer | null {
		return (!row.loose && this.settings.enabled && this.offers.find(offer => offer.first === row.node.first)) || null
	}

	offerText(row: Row) {
		const offer = (this.offerFor(row) as Offer)
		return this.fmt(offer.pages.length === 1 ? PREFIX + 'pagination_offerTextOne' : PREFIX + 'pagination_offerText', this.pagesText(offer.pages))
	}

	offerButton(row: Row) {
		const count = (this.offerFor(row) as Offer).pages.length
		return this.fmt(count === 1 ? PREFIX + 'pagination_offerAcceptOne' : PREFIX + 'pagination_offerAccept', count)
	}

	/** the offered labels of that block; the blocks after it that continue it follow */
	acceptOffer(first: number) {
		const offer = this.offers.find(o => o.first === first)
		if (!offer) {
			return
		}
		const result = acceptOffers(this.pages, this.settings, [offer], this.strategies)
		this.commit(result.pages, { paginate: false, offers: result.offers })
	}

	/** every open offer in one change; the blocks after them that continue them follow */
	acceptAllOffers() {
		if (this.offers.length === 0) {
			return
		}
		const result = acceptOffers(this.pages, this.settings, this.offers, this.strategies)
		this.commit(result.pages, { paginate: false, offers: result.offers })
	}

	/** the offer stays hidden until its block changes */
	dismissOffer(first: number) {
		this.dismissedOffers = new Map(this.dismissedOffers).set(first, this.offerSignature(first))
		this.offers = this.offers.filter(offer => offer.first !== first)
	}

	dismissAllOffers() {
		this.dismissedOffers = new Map([...this.dismissedOffers, ...this.offers.map(offer => [offer.first, this.offerSignature(offer.first)] as const)])
		this.offers = []
	}

	// ---- banners

	/* asks first, naming how many pages lose their changed label */
	askRestoreLabels() {
		const count = this.unsaved.labels.length
		this.askConfirmation(PREFIX + 'restore_title', PREFIX + (count === 1 ? 'restore_confirmOne' : 'restore_confirm'), PREFIX + 'restore_title',
			() => this.restoreLabels(), undefined, [count])
	}

	/* all labels from the METS as last loaded, all offers gone */
	restoreLabels() {
		this.applyChange(restoreFromMets(this.pages), { paginate: false, afterCommit: () => this.clearOffers() })
	}

	// ---- scrolling and jumping

	/** scrolls to the next block that shows an offer, after the one of the last jump; from the last one back to the first */
	jumpToNextOffer() {
		const elements = [...this.root.querySelectorAll('[data-offer]')] as HTMLElement[]
		if (elements.length === 0) {
			return
		}
		this.offerCursor = (this.offerCursor + 1) % elements.length
		elements[this.offerCursor].scrollIntoView({ behavior: 'smooth', block: 'center' })
	}

	/** scrolls smoothly so that the row of the block starts just below the sticky [data-help] element (the bottom edge of the title bar); after a change it waits until the new rows are drawn */
	async scrollToBlock(first: number) {
		await tick()
		const element = document.getElementById(this.blockElementId({ first, level: 0 }))
		const help = (this.root.querySelector('[data-help]') as HTMLElement | null)
		if (!element) {
			return
		}
		const below = help ? (parseFloat(getComputedStyle(help).top) || 0) + help.offsetHeight : 0
		window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - below, behavior: 'smooth' })
	}

	/** scrolls to the next block with this problem (cycling) and puts the cursor into its type drop-down */
	jumpToProblem(name: 'missingType' | 'notAllowed' | 'invalidDate' | 'missingRequired' | 'duplicates') {
		const refs = [...new Map(this.validation[name].map(ref => [`${ref.page}:${ref.level}`, ref])).values()]
		if (refs.length === 0) {
			return
		}
		const next = ((this.problemCursor[name] ?? -1) + 1) % refs.length
		this.problemCursor[name] = next
		const ref = refs[next]
		const element = document.getElementById(this.blockElementId({ first: ref.page, level: ref.level }))
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
			const select = (ref.level === 0 ? element.nextElementSibling : element)?.querySelector('select')
			if (select) {
				select.focus({ preventScroll: true })
			}
		}
	}

	jumpToNextHidden() {
		const blocks = this.hiddenBlocks
		if (blocks.length === 0) {
			return
		}
		this.hiddenCursor = (this.hiddenCursor + 1) % blocks.length
		const element = document.getElementById(this.blockElementId(blocks[this.hiddenCursor]))
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}
	}

	/** what "Zum nächsten" can reach, in page order: the changed blocks (a block before a run starting at its first page) and the runs of changed labels on any page */
	unsavedTargets = $derived.by(() => {
		const targets: { at: number, level: number, block: boolean }[] = [...this.unsaved.blocks.keys()].map(key => {
			const [first, level] = key.split(':').map(Number)
			return { at: first, level, block: true }
		})
		const labels = [...this.unsaved.labels].sort((a, b) => a - b)
		labels.forEach((index, k) => k > 0 && labels[k - 1] === index - 1 || targets.push({ at: index, level: 0, block: false }))
		return targets.sort((a, b) => a.at - b.at || Number(b.block) - Number(a.block) || a.level - b.level)
	})

	/** scrolls to the next unsaved thing, cycling through unsavedTargets */
	jumpToNextUnsaved() {
		const targets = this.unsavedTargets
		if (targets.length === 0) {
			return
		}
		this.unsavedCursor = (this.unsavedCursor + 1) % targets.length
		const target = targets[this.unsavedCursor]
		const element = target.block
			? document.getElementById(this.blockElementId({ first: target.at, level: target.level }))
			: this.root.querySelector(`[data-label="${target.at + 1}"]`)
		const shown = (target.block ? element : element?.closest('.newspaper-thumbnail, .thumbnail-image')) ?? element
		shown?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}

	/** true if there is a label field to go to */
	moveLabelFocus(index: number, delta: number) {
		const field = (this.root.querySelector(`[data-label-input="${index + delta + 1}"]`) as HTMLElement | null)
		if (field) {
			field.focus()
		}
		return !!field
	}

	// ---- the label being typed

	previewLabelAt(index: number, text: string, mode: LabelMode) {
		this.preview = { index, text, mode, result: previewLabel(this.pages, this.settings, index, text, mode, this.strategyOfKey) }
	}

	cancelLabel() {
		if (this.preview) {
			this.preview = null
		}
	}

	commitLabel(index: number, text: string, mode: LabelMode) {
		const result = previewLabel(this.pages, this.settings, index, text, mode, this.strategyOfKey)
		this.preview = null
		const changes = result.pages.map((page, i) => i).filter(i => result.pages[i].label !== this.pages[i].label)
		if (changes.length === 0) {
			return
		}
		// the typing stops at the block end; the blocks after it that continue it follow (by the strategies before the edit) only while the
		// block still matches a strategy, else they are offered
		const chained = afterTyping(result.pages, this.settings, this.strategies, this.chosen, index, mode)
		this.commit(chained.pages, { paginate: false, offers: chained.offers })
	}

	/* the edit of a label field that lost its focus to a pointer press; runs before the handler of the click */
	commitDeferredEdit() {
		const field = (document.activeElement as HTMLElement | null)
		if (this.preview && !(field && field.dataset && field.dataset.labelInput === String(this.preview.index + 1))) {
			this.commitOpenEdit()
		}
	}

	/* the edit in the open label field belongs to what is saved */
	commitOpenEdit() {
		if (this.preview) {
			this.commitLabel(this.preview.index, this.preview.text, this.preview.mode)
		}
	}

	/** what is recognised and what follows while a label is typed; shown under the block of the page */
	hintFor(row: Row) {
		const typed = this.preview
		if (!typed || !(row.loose ? row.pages.includes(typed.index) : typed.index >= row.node.first && typed.index <= row.node.last)) {
			return ''
		}
		const result = typed.result
		const key = (name: string) => `${PREFIX}pagination_hint_${name}`
		const changing = result.run.filter(i => result.pages[i].label !== this.pages[i].label)
		const run = changing.length === 0 ? '' : this.fmt(changing.length === 1 ? key('runOne') : key('runMany'), changing.length, changing[changing.length - 1] + 1)
		let text
		if (result.kind === 'empty') {
			text = this.fmt(key('follow'), result.value) + (run ? ' · ' + run : '')
		} else if (!isCounting(result.value)) {
			const kind = this.t(key(result.kind === 'none' ? 'none' : 'text'))
			text = this.fmt(key('recognized'), kind) + ' · ' + this.t(key('single'))
		} else {
			const parsed = parseLabel(result.value)
			const kind = this.t(key(parsed.kind)) + (parsed.fictitious ? this.t(key('fictitious')) : '')
			text = this.fmt(key('recognized'), kind) + ' · ' + (run || this.t(result.run.length > 0 ? key('noChange') : key('runNone')))
			if (result.stop !== null && isCounting(this.pages[result.stop].label)) {
				text += ' · ' + this.fmt(key('stop'), result.stop + 1)
			} else if (result.stop === null && changing.length > 0) {
				text += ' · ' + this.t(key('toEnd'))
			}
		}
		return text + ' · ' + this.t(key('keys'))
	}

	// ---- edits of a block

	onPageClick(e: MouseEvent, index: number) {
		if (e.shiftKey || this.saveInFlight) {
			return // shift is used for zooming
		}
		if (e.altKey || e.ctrlKey) {
			this.applyChange(toggleChild(this.pages, index, this.catalog), { bulk: false })
			return
		}
		const blockStart = this.tree.roots.some(root => root.first === index)
		if (blockStart && !canMerge(this.pages, index)) {
			return
		}
		this.applyChange(toggleBlock(this.pages, index), { bulk: false, afterCommit: blockStart ? undefined : () => this.scrollToBlock(index) })
	}

	changeType(node: BlockNode, type: string | null) {
		if (type === '__loose__') {
			this.applyChange(makeLoose(this.pages, node.first), { bulk: false })
			return
		}
		this.applyChange(setType(this.pages, refOf(node), type, this.catalog), { bulk: false })
	}

	changeDate(node: BlockNode, value: string) {
		setDateInput(node.start, value, this.dateFormatPattern)
		this.touch()
	}

	changeField(node: BlockNode, name: 'prefix' | 'number' | 'suffix', value: string) {
		node.start[name] = value === '' ? null : value
		this.touch()
	}

	changeValue(node: BlockNode, key: string, value: string) {
		setFieldValue(node, key, value, this.catalog)
		this.touch()
	}

	resetValue(node: BlockNode, key: string) {
		resetFieldValue(node.start, key)
		this.touch()
	}

	keepValue(node: BlockNode, key: string) {
		keepFieldValue(node, key, this.catalog)
		this.touch()
	}

	// ---- popovers and dialogs

	toggleActions() {
		if (this.saveInFlight) {
			return
		}
		this.actionsOpen = !this.actionsOpen
	}

	runAction(action: () => void) {
		this.actionsOpen = false
		action()
	}

	toggleHidden(key: string) {
		this.openHidden = this.openHidden === key ? null : key
	}

	openDialog(kind: 'pattern' | 'continue', node: BlockNode) {
		this.dialog = { kind, ref: refOf(node), typeOptions: this.typeOptions(node.parent ? node.parent.start.type : this.volumeType) }
	}

	/** the rules dialog; first is the first page of the block it was opened from, null from the actions menu; scope 'offers' preselects the open offers */
	openRulesDialog(first: number | null, scope?: 'offers') {
		this.dialog = { kind: 'rules', first, types: this.ruleTypes(), scope }
	}

	closeDialog() {
		this.dialog = null
	}

	/**
	 * The rules of the dialog replace the settings of this session; the scope decides which labels they overwrite. Scope offers relabels only
	 * the offered pages (and the blocks continuing them), keeps the settings when the rules were not edited and the other offers open. Any
	 * other scope voids the open offers; its blocks get the default strategies of the new rules, which the session keeps as picked entries.
	 */
	applyRules(settings: PaginationSettings, scope: RulesScope) {
		this.dialog = null
		if (scope.kind === 'offers') {
			if (!sameSettings(settings, this.settings)) {
				this.settings = settings
			}
			const applied = new Set((scope.offers ?? []).map(offer => offer.first))
			this.offers = this.offers.filter(offer => !applied.has(offer.first))
		} else {
			this.settings = settings
			this.clearOffers()
		}
		let pages = this.pages
		let offers: FreshOffer[] = []
		if (scope.kind !== 'none') {
			const result = simulateRules(this.pages, settings, scope, this.strategies)
			pages = result.pages
			offers = result.offers
			const chosen = new Map(this.chosen)
			for (const [key, id] of result.strategies) {
				const [first, level] = key.split(':').map(Number)
				chosen.set(`${this.pages[first].filename}:${level}`, id)
			}
			this.chosen = chosen
		}
		if (this.sameState(this.pages, pages)) {
			this.strategies = this.detect()
			this.refresh()
			this.updateOffers(offers)
			return
		}
		this.applyChange(pages, { paginate: false, offers })
	}

	// ---- the pagination strategy of a block

	/** the strategies of the pages as they are, read from their labels; none without pagination */
	detect() {
		return this.settings.enabled ? detectStrategies(this.pages, this.settings, this.chosen) : new Map<string, string>()
	}

	/** the strategy of the node by node key, for streams and the typing */
	strategyOfKey: StrategyOf = key => this.strategies.get(key) ?? 'hand'

	strategyOf(node: BlockNode) {
		return this.strategyOfKey(nodeKey(node))
	}

	strategyOptionsFor(node: BlockNode): StrategyOption[] {
		return strategyOptions(this.tree, node, this.settings, this.strategyOf(node))
	}

	/** 'rules' opens the rules dialog for the top-level block of the node; any other entry relabels the node by it and is kept as picked */
	setStrategy(node: BlockNode, id: string) {
		if (id === 'rules') {
			let root = node
			while (root.parent) {
				root = root.parent
			}
			this.openRulesDialog(root.first)
			return
		}
		this.chosen = new Map(this.chosen).set(`${this.pages[node.first].filename}:${node.level}`, id)
		const result = applyStrategy(this.pages, this.settings, this.strategies, node, id)
		this.commit(result.pages, { paginate: false, offers: result.offers })
	}

	applyPattern(pattern: string[]) {
		const ref = this.dialog && 'ref' in this.dialog ? this.dialog.ref : null
		if (!ref) {
			return
		}
		this.dialog = null
		const total = siblingsFrom(this.tree, ref).length
		this.applyChange(applyTypePattern(this.pages, ref, pattern, this.catalog), { bulk: true, total })
	}

	applyGenerated(newPages: Page[]) {
		this.dialog = null
		syncDateInputs(newPages, this.dateFormatPattern)
		this.applyChange(newPages, { bulk: true })
	}

	// ---- confirmations

	/** every confirmation guards a destructive action; icon is optional (e.g. 'trash') */
	askConfirmation(title: string, text: string, button: string, action: () => void, icon?: string, params?: (string | number)[]) {
		this.confirmation = { title, text, button, action, icon, params }
	}

	cancelConfirmation() {
		this.confirmation = null
	}

	runConfirmation() {
		const action = this.confirmation?.action
		this.confirmation = null
		action?.()
	}

	askRemoveHidden(node: BlockNode) {
		this.openHidden = null
		this.askConfirmation(PREFIX + 'hidden_remove', PREFIX + 'hidden_confirmRemove', PREFIX + 'hidden_remove', () => {
			const pages = clonePages(this.pages)
			applyResolution(pages, explicitConflict(node.start, node.first), 'REMOVE_ALL', this.catalog, this.volumeType)
			this.operations = upsertOperation(this.operations, node.start.id, 'EXPLICIT', 'REMOVE_ALL')
			this.commit(pages, { paginate: false })
		}, 'trash')
	}

	askResetToAnalysis() {
		this.askConfirmation(PREFIX + 'action_takeAnalysis', PREFIX + 'confirmResetToAnalysis', PREFIX + 'action_takeAnalysis',
			() => this.applyChange(resetToAnalysis(this.pages), { bulk: true, total: flatten(this.tree.roots).length }))
	}

	askRemoveAllBlocks() {
		this.askConfirmation(PREFIX + 'removeAllBlocks', PREFIX + 'removeAllBlocks_confirm', PREFIX + 'removeAllBlocks',
			() => this.applyChange(removeAllBlocks(this.pages), { bulk: true, total: flatten(this.tree.roots).length }), 'trash')
	}

	askRecompute() {
		this.askConfirmation(PREFIX + 'action_restartAnalysis', PREFIX + 'confirmRecompute', PREFIX + 'action_restartAnalysis',
			() => this.bridge.restartAnalysis())
	}

	askDeletePage(index: number) {
		if (this.saveInFlight) {
			return
		}
		this.askConfirmation('loeschen', PREFIX + 'confirmDeleteImage', 'loeschen', () => this.deletePage(index), 'trash')
	}

	/** once the change is accepted (the user may be asked about hidden data first): delete the image and save right away */
	deletePage(index: number) {
		const page = this.pages[index]
		this.applyChange(removePage(this.pages, index), {
			bulk: false,
			removed: index,
			afterCommit: fresh => {
				const structures = [...this.volumeHidden.structures]
				shiftStructures(structures, index)
				this.volumeHidden = { ...this.volumeHidden, structures }
				this.bridge.deleteFile(page.filename, index)
				this.offersAcrossSave = this.offers.filter(offer => fresh.some(other => other.first === offer.first))
					.map(offer => ({ file: this.pages[offer.first].filename, offer }))
				this.save(false)
				if (!this.saveInFlight) {
					this.offersAcrossSave = []
				}
			},
		})
	}

	// ---- saving and leaving: the bridge to the JSF forms

	/* follows the AJAX requests of the save button */
	listenToFaces() {
		this.bridge.listen({
			busy: busy => { this.ajaxBusy = busy },
			// the request has been answered, whatever its outcome: allow interaction again
			settled: () => { this.saveInFlight = false },
			succeeded: () => this.applySaveResult(),
			// a save request that never reached the backend must leave the data dirty, so it can be sent again
			failed: () => {
				this.offersAcrossSave = []
				this.saveInFlight = false
				this.pendingExit = false
			},
		})
	}

	/* only a confirmed write means the data is persisted; then take over the freshly read state (new ids, hidden data) */
	applySaveResult() {
		const kept = this.offersAcrossSave
		this.offersAcrossSave = []
		if (!this.bridge.saveSucceeded()) {
			this.pendingExit = false
			return
		}
		this.loadData(this.bridge.readData())
		this.restoreOffers(kept)
		if (this.pendingExit) {
			this.pendingExit = false
			this.bridge.finish()
		}
	}

	openSaveBlocked() {
		this.saveBlockedOpen = true
	}

	closeSaveBlocked() {
		this.saveBlockedOpen = false
		this.saveBlockedLeave = false
	}

	/* the save button: while something blocks saving it explains what instead of doing nothing; the save after a deletion stays silent */
	save(explain = true) {
		this.commitOpenEdit()
		if (this.saveBlocked && !this.saveInFlight && this.hasUnsaved && explain) {
			this.openSaveBlocked()
			return
		}
		if (!this.canSave) {
			return
		}
		this.saveInFlight = true
		this.bridge.submitSave(toSaveRequest(this.pages, this.operations, this.catalog))
	}

	/* the leave button: nothing unsaved leaves right away; an invalid state shows what blocks saving, with the way out "leave anyway";
	   otherwise the user decides between saving and discarding */
	leave() {
		if (this.saveInFlight) {
			return
		}
		this.commitOpenEdit()
		if (!this.hasUnsaved) {
			this.bridge.finish()
			return
		}
		if (this.saveBlocked) {
			this.saveBlockedLeave = true
			this.openSaveBlocked()
			return
		}
		this.leaveOpen = true
	}

	closeLeave() {
		this.leaveOpen = false
	}

	saveAndLeave() {
		this.leaveOpen = false
		this.pendingExit = true
		this.save()
	}

	/* "Änderungen verwerfen" and "Trotzdem verlassen": the unsaved state is dropped with the page */
	leaveWithoutSaving() {
		this.leaveOpen = false
		this.saveBlockedOpen = false
		this.saveBlockedLeave = false
		this.bridge.finish()
	}
}

/* the backend may report the wrong scheme (e.g. http behind an https reverse proxy), which the img-src 'self' CSP then
   blocks as cross-origin. Stripping scheme/host/port avoids that regardless of proxy config. */
function toSameOriginUrl(url: string) {
	if (!url) {
		return url
	}
	try {
		const parsed = new URL(url, window.location.href)
		if (parsed.hostname !== window.location.hostname) {
			return url
		}
		return parsed.pathname + parsed.search + parsed.hash
	} catch (e) {
		return url
	}
}
