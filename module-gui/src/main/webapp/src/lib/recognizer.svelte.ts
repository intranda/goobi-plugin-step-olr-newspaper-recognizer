import { createContext, tick } from 'svelte'
import {
	buildTree, flatten, refOf, toggleBlock, toggleChild, setType, setDateInput, initStarts, validateBlocks,
	removeAllBlocks, resetToAnalysis, removePage, shiftStructures, toSaveRequest, clonePages, siblingsFrom, syncDateInputs,
	canMerge, makeLoose, shiftIndex,
} from './logic/blocks.mjs'
import { initLabels, structureChanged, streams, volumeOffers, applyOffers } from './logic/pagination.mjs'
import { missingRuns, fillMissing, restoreFromMets, simulateRules, sameSettings } from './logic/pagination-tools.mjs'
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
import type { Baseline, Unsaved, BlockFlags, Catalog, BlockNode, BlockRef, ChangeOptions, Confirmation, DialogState, FieldState, FreshOffer, Hidden, LabelMode, LabelPreview, Notice, Offer, Operation, Page, PaginationSettings, PendingChange, PluginProps, Problem, Row, RulesScope, Tree, TypeOption, Validation, VolumeStream } from '../types';

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
	offerFrom: number | null = $state(null) // counting through the volume: first page of the first block whose offers follow the volume count
	dismissedOffers: Map<number, string | null> = $state.raw(new Map()) // first page of a dismissed block → its signature at dismissal
	preview: LabelPreview | null = $state.raw(null) // {index, text, mode, result}: the label being typed
	settings: PaginationSettings = $state.raw(({} as PaginationSettings))

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
	missingDeclined = $state(false) // "Nicht erzeugen": the banner stays hidden until the plugin is opened again (not reset by loadData)
	confirmation: Confirmation | null = $state.raw(null) // {title, text, button, action, icon, params}
	openHidden: string | null = $state(null) // element id of the block whose hidden data is listed, or 'volume'
	pendingChange: PendingChange | null = $state.raw(null) // a change waiting for the user's decision about hidden data
	dialog: DialogState | null = $state.raw(null) // {kind: 'pattern' | 'continue' | 'rules', ...}

	// plain fields
	pendingExit = false // set by saveAndExit, acted upon once the backend confirms the write
	pointerDown = false
	operations: Operation[] = $state.raw([])
	hiddenCursor = -1
	offerCursor = -1
	unsavedCursor = -1
	noticesOpen = $state(false) // the section "Hinweise" is collapsed at every opening of the plugin
	lastJumped = -1 // index of the first page of the run the last jump led to
	problemCursor: Record<string, number> = {}
	// the element of the app, set by App.svelte before anything uses it
	root: HTMLElement = (null as any)

	hiddenBlocks = $derived(flatten(this.tree.roots).filter(node => hasHidden(node.start)))
	missingRunList = $derived(missingRuns(this.pages))
	showMissingBanner = $derived(this.settings.enabled && !this.missingDeclined && this.missingRunList.length > 0)
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
		this.clearOffers()
		this.preview = null
		this.refresh()
	}

	refresh() {
		this.tree = buildTree(this.pages)
		this.validation = validateBlocks(this.pages, this.catalog, this.volumeType, this.preventDuplicates)
		this.flags = this.indexFlags(this.validation)
		this.rows = this.buildRows(this.tree)
		this.ownFlags = this.settings.enabled ? ownNumberingAll(this.pages, this.settings) : []
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
			this.commit(newPages, options)
			if (options.afterCommit) {
				options.afterCommit()
			}
			return
		}
		this.pendingChange = { pages: newPages, conflicts, options }
	}

	sameState(before: Page[], after: Page[]) {
		const plain = (pages: Page[]) => JSON.stringify(pages.map(({ depth, label, starts }) => [depth, label, starts]))
		return before.length === after.length && plain(before) === plain(after)
	}

	/** a structure change paginates what it needs (unless options.paginate is false) */
	commit(newPages: Page[], options: ChangeOptions = {}) {
		let pages = newPages
		let offers: FreshOffer[] = []
		let offerFrom: number | null = null
		if (this.settings.enabled && options.paginate !== false) {
			const result = structureChanged(this.pages, newPages, this.settings)
			pages = result.pages
			offers = result.offers
			offerFrom = result.offerFrom
		} else if (options.offerFrom !== undefined) {
			offerFrom = options.offerFrom
		}
		if (options.removed !== undefined) {
			const removed = options.removed
			this.offerFrom = this.offerFrom === null ? null : shiftIndex(this.offerFrom, removed)
			this.dismissedOffers = new Map([...this.dismissedOffers].map(([first, signature]) => [shiftIndex(first, removed), signature]))
		}
		this.pages = pages
		this.refresh()
		this.updateOffers(offers, offerFrom)
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
		this.commit(pages, options)
		if (options.afterCommit) {
			options.afterCommit()
		}
	}

	cancelConflicts() {
		this.pendingChange = null
	}

	// ---- offers of "Neu nach Regeln"

	clearOffers() {
		this.offers = []
		this.offerFrom = null
		this.dismissedOffers = new Map()
	}

	/**
	 * The open offers after a change. Per block: fresh ones of a structure change and the earlier ones whose block is as it was (keepOffers).
	 * When counting through the volume: every block from offerFrom on (the earlier one of the old and the fresh offerFrom) that differs from the
	 * volume count, except the dismissed ones whose block is as it was at dismissal; offerFrom ends when no block from there differs.
	 */
	updateOffers(fresh: FreshOffer[], freshFrom: number | null) {
		if (!this.settings.countThroughVolume) {
			this.offerFrom = null
			this.dismissedOffers = new Map()
			this.offers = this.keepOffers(fresh)
			return
		}
		const old = this.offerFrom
		const from = freshFrom === null ? old : old === null ? freshFrom : Math.min(old, freshFrom)
		const volume = from === null ? [] : volumeOffers(this.pages, this.settings, from)
		if (volume.length === 0) {
			this.clearOffers()
			return
		}
		const dismissed = new Map([...this.dismissedOffers].filter(([first, signature]) => signature === this.offerSignature(first)))
		this.offerFrom = from
		this.dismissedOffers = dismissed
		this.offers = volume.filter(offer => !dismissed.has(offer.first)).map(offer => ({ ...offer, signature: this.offerSignature(offer.first) }))
	}

	/** an offer belongs to its block as it is: another structure change, child type or label in the block makes it disappear; a page removed before it does not */
	offerSignature(first: number) {
		const node = this.tree.roots.find(root => root.first === first)
		if (!node) {
			return null
		}
		return JSON.stringify([node.last - node.first, node.start.type,
			this.pages.slice(node.first, node.last + 1).map(page => [page.label, page.depth, page.starts.map(start => start.type)])])
	}

	keepOffers(fresh: FreshOffer[]) {
		const offers = fresh.map(offer => ({ ...offer, signature: this.offerSignature(offer.first) }))
		for (const offer of this.offers) {
			if (!offers.some(o => o.first === offer.first) && offer.signature === this.offerSignature(offer.first)) {
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

	/** the offered labels of that block; when counting through the volume the cumulative ones, also with earlier offers still open */
	acceptOffer(first: number) {
		const offer = this.offers.find(o => o.first === first)
		if (!offer) {
			return
		}
		this.commit(applyOffers(this.pages, this.settings, [offer], this.offerFrom), { paginate: false })
	}

	/** every open offer in one change, the same labels as accepting them one by one in page order */
	acceptAllOffers() {
		if (this.offers.length === 0) {
			return
		}
		this.commit(applyOffers(this.pages, this.settings, this.offers, this.offerFrom), { paginate: false })
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

	missingText() {
		const count = this.missingRunList.reduce((sum, [first, last]) => sum + last - first + 1, 0)
		return count === 1 ? this.t(PREFIX + 'pagination_missing_one') : this.fmt(PREFIX + 'pagination_missing_many', count)
	}

	/* every page without label gets its rule value */
	generateMissing() {
		this.applyChange(fillMissing(this.pages, this.settings), { paginate: false })
	}

	/* hides the banner until the plugin is opened again */
	declineMissing() {
		this.missingDeclined = true
	}

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

	/* scrolls to the first run of pages without label after the last jumped one (else the first run), centres its first page and lets
	   its label fields flash; no focus */
	jumpToMissing() {
		const runs = this.missingRunList
		const run = runs.find(([first]) => first > this.lastJumped) || runs[0]
		if (!run) {
			return
		}
		const [first, last] = run
		const field = (index: number) => (this.root.querySelector(`[data-label="${index + 1}"]`) as HTMLElement | null)
		const target = field(first)
		if (!target) {
			return
		}
		this.lastJumped = first;
		(target.closest('.newspaper-thumbnail, .thumbnail-image') || target).scrollIntoView({ behavior: 'smooth', block: 'center' })
		this.root.querySelectorAll('.newspaper-flash').forEach(element => element.classList.remove('newspaper-flash')) // the flash of an earlier jump is over
		flash(Array.from({ length: last - first + 1 }, (_, k) => field(first + k)))
	}

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
		this.preview = { index, text, mode, result: previewLabel(this.pages, this.settings, index, text, mode) }
	}

	cancelLabel() {
		if (this.preview) {
			this.preview = null
		}
	}

	commitLabel(index: number, text: string, mode: LabelMode) {
		const result = previewLabel(this.pages, this.settings, index, text, mode)
		this.preview = null
		const changes = result.pages.map((page, i) => i).filter(i => result.pages[i].label !== this.pages[i].label)
		if (changes.length === 0) {
			return
		}
		// counting through the volume the typing stops at the block end; the later blocks that no longer fit become offers
		const volume = this.settings.countThroughVolume ? this.volumeStream(this.settings) : undefined
		const offerFrom = volume?.pages.includes(index) ? this.volumeBlockAfter(volume, index) : null
		this.commit(result.pages, { paginate: false, offerFrom })
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
	 * the offered pages, keeps the settings when the rules were not edited and the other offers open. Any other scope voids the open offers;
	 * when counting through the volume, scope block turns the following blocks that no longer fit into offers.
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
			if (scope.kind === 'block' && settings.countThroughVolume) {
				this.offerFrom = this.volumeBlockAfter(this.volumeStream(settings), scope.first as number)
			}
		}
		const pages = scope.kind === 'none' ? this.pages : simulateRules(this.pages, settings, scope)
		if (this.sameState(this.pages, pages)) {
			this.refresh()
			this.updateOffers([], null)
			return
		}
		this.applyChange(pages, { paginate: false })
	}

	/** the stream of the blocks counted through the volume with these settings */
	volumeStream(settings: PaginationSettings): VolumeStream | undefined {
		return streams(this.pages, settings).list.find((stream: { key: string }) => stream.key === 'volume')
	}

	/** first page of the first block of the volume stream after page index, null if none follows */
	volumeBlockAfter(volume: VolumeStream | undefined, index: number) {
		return volume?.parts.find(part => part.block > index)?.block ?? null
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
			paginate: false, // deleting an image changes no other label
			removed: index,
			afterCommit: () => {
				const structures = [...this.volumeHidden.structures]
				shiftStructures(structures, index)
				this.volumeHidden = { ...this.volumeHidden, structures }
				this.bridge.deleteFile(page.filename, index)
				this.save(false)
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
				this.saveInFlight = false
				this.pendingExit = false
			},
		})
	}

	/* only a confirmed write means the data is persisted; then take over the freshly read state (new ids, hidden data) */
	applySaveResult() {
		if (!this.bridge.saveSucceeded()) {
			this.pendingExit = false
			return
		}
		this.loadData(this.bridge.readData())
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

	saveAndExit() {
		if (this.saveInFlight) {
			return
		}
		this.commitOpenEdit()
		if (!this.hasUnsaved) {
			this.bridge.finish()
			return
		}
		if (this.saveBlocked) {
			this.openSaveBlocked()
			return
		}
		this.pendingExit = true
		this.save()
	}

	exit() {
		if (this.saveInFlight) {
			return
		}
		if (this.hasUnsaved) {
			this.askConfirmation('pluginLeave', PREFIX + 'confirmLeaveUnsaved', 'pluginLeave', () => this.bridge.finish())
			return
		}
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
