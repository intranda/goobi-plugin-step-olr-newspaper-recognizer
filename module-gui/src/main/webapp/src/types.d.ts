/* The data of the plugin page: what the backend sends (see plugin_newspaperRecognizer.xhtml) and what logic/*.mjs derives from it. */

export interface HiddenStructure { label: string; title?: string; firstPage: number; lastPage: number }
export interface HiddenMetadata { label: string; value: string }
/** Additional data of a block that the plugin keeps but shows no fields for */
export interface Hidden { structures: HiddenStructure[]; metadata: HiddenMetadata[] }

/** The start of a block: a page begins this structure */
export interface Start {
	id: string | null;
	type: string | null;
	date: string | null; // ISO
	dateRaw: string | null;
	dateInput: string;
	prefix: string | null;
	number: string | null;
	suffix: string | null;
	hidden: Hidden;
	originalType: string | null;
	values?: Record<string, string>;
	generatedBase?: Record<string, string>;
}

export interface PageImage { thumbnailUrl: string; largeThumbnailUrl: string; tooltip: string }

export interface Page {
	filename: string;
	result?: number;
	/** number of open blocks on the page */
	depth: number;
	/** the starts of the blocks that begin on this page, outermost first */
	starts: Start[];
	label?: string;
	/** the label as last loaded from the METS */
	metsLabel?: string;
	image: PageImage;
}

export interface BlockNode { start: Start; level: number; first: number; last: number; parent: BlockNode | null; children: BlockNode[] }
export interface Tree { roots: BlockNode[]; loose: number[] }
export interface BlockRef { page: number; level: number }

export type FieldDisplay = 'input' | 'textarea' | 'select1' | 'readonly';
export interface FieldItem { value: string; label: string }
export interface FieldDef { key: string; label: string; display: FieldDisplay; required?: boolean; pattern?: string | null; items: FieldItem[] }
/** A field of a block with the value it shows (see logic/fields.mjs) */
export interface FieldState extends FieldDef { generated: string | null; value: string; overwritten: boolean; stale: boolean }

export interface TypeInfo {
	name: string;
	label: string;
	dated: boolean;
	numbered: boolean;
	partNumbered: boolean;
	dateRequired: boolean;
	numberRequired: boolean;
	children: string[];
	allowedMetadata: string[];
	managedMetadata: string[];
	fields?: FieldDef[];
}
export type Catalog = Record<string, TypeInfo>;

/** The state as last loaded or saved (logic/unsaved.mjs savedState): the blocks that have an id by id, and the number of structures hidden at the volume. */
export interface Baseline {
  blocks: Map<string, unknown>;
  volumeStructures: number;
}

/** What differs from the baseline (logic/unsaved.mjs unsavedChanges): the changed blocks by "first:level", the pages with a changed label, the number of removed blocks. */
export interface Unsaved {
  blocks: Map<string, { isNew: boolean; fields: string[]; boundary: boolean; nesting: boolean; hidden: boolean }>;
  labels: number[];
  removed: number;
  volume: boolean;
  count: number;
  any: boolean;
}
export interface TypeOption { name: string; label: string }

export interface PaginationRule { beginsWith: string[]; continueInParent?: boolean }
export interface PaginationSettings {
	enabled: boolean;
	automatic: boolean;
	countThroughVolume: boolean;
	withoutBlock: string[];
	rules: Record<string, PaginationRule>;
}
/** the pages of one level-0 block (or loose run) in a pagination stream, with the rule of that block */
export interface StreamPart { block: number; rule: string[] | null; pages: number[] }
export interface RulesScope { kind: 'none' | 'block' | 'fromBlock' | 'volume' | 'offers'; first: number | null | undefined; offers?: FreshOffer[]; from?: number | null }

export interface Validation {
	valid: boolean;
	missingType: BlockRef[];
	notAllowed: BlockRef[];
	invalidDate: BlockRef[];
	missingRequired: BlockRef[];
	duplicates: BlockRef[];
}
export type Problem = 'missingType' | 'notAllowed' | 'invalidDate' | 'missingRequired' | 'duplicates';
export type BlockFlags = Partial<Record<'missingType' | 'notAllowed' | 'invalidDate' | 'missingRequired' | 'duplicate' | 'missingDate' | 'missingNumber', boolean>>;

export type Row = { loose: false; key: string; node: BlockNode } | { loose: true; key: string; pages: number[] };

export type LabelMode = 'follow' | 'single' | 'toEnd';
export interface LabelPreviewResult { pages: Page[]; run: number[]; stop: number | null; kind: string; value: string; end: number }
/** The label being typed */
export interface LabelPreview { index: number; text: string; mode: LabelMode; result: LabelPreviewResult }

export interface Offer { first: number; pages: number[]; signature: string | null }
/** an offer as the pagination logic reports it, before it is tied to its block */
export type FreshOffer = Omit<Offer, 'signature'>
export interface Notice { key: string; params?: string[] }
export interface Operation { blockId: string; kind: string; action: string }

export interface Conflict { kind: 'DELETED' | 'TYPE' | 'BOUNDARY' | 'EXPLICIT'; blockId: string; type: string | null; page: number; structures: HiddenStructure[]; metadata: HiddenMetadata[]; options: string[] }
/** removed: index of a page removed by the change, so that offers can follow it; offerFrom: without paginating, the first page of the block from which the volume offers follow */
export interface ChangeOptions { bulk?: boolean; total?: number; paginate?: boolean; removed?: number; offerFrom?: number | null; afterCommit?: () => void }
/** The stream of the blocks counted through the volume, see streams in logic/pagination.mjs */
export interface VolumeStream { key: string; pages: number[]; parts: { block: number; pages: number[] }[] }
export interface PendingChange { pages: Page[]; conflicts: Conflict[]; options: ChangeOptions }

export type DialogState =
	| { kind: 'pattern' | 'continue'; ref: BlockRef; typeOptions: TypeOption[] }
	| { kind: 'rules'; first: number | null; types: string[]; scope?: 'offers' };
export interface Confirmation { title: string; text: string; button: string; action: () => void; icon?: string }

/** The options of the page, see plugin_newspaperRecognizer.xhtml */
export interface PluginProps {
	data_el: HTMLInputElement;
	saveButton: HTMLElement;
	saveResultEl: HTMLElement;
	finishButton: HTMLElement;
	restartAnalysisButton: HTMLElement;
	deleteFileButton: HTMLElement;
	language: string;
	thumbHeight: number;
	title: string;
	loadallimages: boolean;
	showDeletePageButton: boolean;
	preventDuplicates: boolean;
	dateFormatPattern: string;
	volumeType: string;
	typeCatalog: TypeInfo[];
	pagination: Partial<PaginationSettings> | null;
	configErrors: string[];
}
