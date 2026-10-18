import mongoose, { Document, Schema } from 'mongoose'

import {
	NEWSROOM_CHANGE_TYPE,
	NEWSROOM_NOTE_STATUS,
	NewsroomChangeType,
	NewsroomNoteStatus,
} from '../shared/newsroom'

type NewsroomActor = {
	_id: string
	displayName: string
	role?: string
	createdAt?: Date
	updatedAt?: Date
}

export interface INewsroomTopic extends Document {
	topicId: string
	name: string
	nameKey: string
	createdAt: Date
	updatedAt: Date
}

export interface INewsroomReleaseNote extends Document {
	releaseNoteId: string
	title: string
	description: string
	version: string
	contentType: string
	status: NewsroomNoteStatus
	releaseDateTime?: Date
	releaseDate?: string
	createdBy: NewsroomActor
	updatedBy?: NewsroomActor
	createdAt: Date
	updatedAt: Date
}

export interface INewsroomChange extends Document {
	changeId: string
	releaseNoteId: string
	title: string
	type?: NewsroomChangeType
	description: string
	image: string
	topicId: string
	sortOrder: number
	createdAt: Date
	updatedAt: Date
}

export interface INewsroomUserState extends Document {
	userId: string
	newsroomItemId: string
	pinned: boolean
	lastVisitedAt?: Date
	acknowledged: boolean
	createdAt: Date
	updatedAt: Date
}

const TopicSchema = new Schema<INewsroomTopic>(
	{
		topicId: { type: String, required: true, unique: true },
		name: { type: String, required: true, trim: true },
		nameKey: { type: String, required: true, unique: true },
	},
	{ timestamps: true },
)

const ReleaseNoteSchema = new Schema<INewsroomReleaseNote>(
	{
		releaseNoteId: { type: String, required: true, unique: true },
		title: { type: String, required: true, trim: true },
		description: { type: String, default: '' },
		version: { type: String, default: '', trim: true },
		contentType: { type: String, required: true, default: 'release_note' },
		status: {
			type: String,
			required: true,
			enum: Object.values(NEWSROOM_NOTE_STATUS),
			default: NEWSROOM_NOTE_STATUS.DRAFT,
		},
		releaseDateTime: { type: Date },
		releaseDate: { type: String },
		createdBy: {
			_id: String,
			displayName: String,
			role: String,
			createdAt: Date,
		},
		updatedBy: {
			_id: String,
			displayName: String,
			role: String,
			updatedAt: Date,
		},
	},
	{ timestamps: true },
)

const ChangeSchema = new Schema<INewsroomChange>(
	{
		changeId: { type: String, required: true, unique: true },
		releaseNoteId: { type: String, required: true, index: true },
		title: { type: String, default: '', trim: true },
		type: {
			type: String,
			enum: Object.values(NEWSROOM_CHANGE_TYPE),
		},
		description: { type: String, default: '' },
		image: { type: String, default: '' },
		topicId: { type: String, default: '', index: true },
		sortOrder: { type: Number, required: true, default: 0 },
	},
	{ timestamps: true },
)

const UserStateSchema = new Schema<INewsroomUserState>(
	{
		userId: { type: String, required: true, trim: true },
		newsroomItemId: { type: String, required: true, trim: true },
		pinned: { type: Boolean, required: true, default: false },
		lastVisitedAt: { type: Date },
		acknowledged: { type: Boolean, required: true, default: false },
	},
	{ timestamps: true },
)

UserStateSchema.index({ userId: 1, newsroomItemId: 1 }, { unique: true })
ReleaseNoteSchema.index({ status: 1, releaseDateTime: -1 })

export const NewsroomTopic = mongoose.model<INewsroomTopic>(
	'NewsroomTopic',
	TopicSchema,
)
export const NewsroomReleaseNote = mongoose.model<INewsroomReleaseNote>(
	'NewsroomReleaseNote',
	ReleaseNoteSchema,
)
export const NewsroomChange = mongoose.model<INewsroomChange>(
	'NewsroomChange',
	ChangeSchema,
)
export const NewsroomUserState = mongoose.model<INewsroomUserState>(
	'NewsroomUserState',
	UserStateSchema,
)
