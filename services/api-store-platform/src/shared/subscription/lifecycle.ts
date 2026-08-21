export const SUBSCRIPTION_STATUS = {
	ACTIVE: 'active',
	EXPIRED: 'expired',
} as const

export type SubscriptionStatus =
	(typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]

export type TenantSubscription = {
	startDate: Date
	renewalDate: Date
	status: SubscriptionStatus
	renewalEnabled: boolean
	lastRenewalDate: Date | null
	notifiedForDate: string | null
	createdAt: Date
	updatedAt: Date
}

export type SubscriptionView = {
	startDate: string
	renewalDate: string
	lastRenewalDate: string | null
	status: SubscriptionStatus
	renewalEnabled: boolean
	remainingDays: number
	warning: boolean
	urgent: boolean
	expired: boolean
}

export type SubscriptionLifecycleConfig = {
	periodDays: number
	warningDays: number
	timeZone: string
}

const MS_PER_DAY = 86_400_000

export const calendarDateInTimeZone = (
	date: Date,
	timeZone: string,
): string => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date)
	const year = parts.find(part => part.type === 'year')?.value
	const month = parts.find(part => part.type === 'month')?.value
	const day = parts.find(part => part.type === 'day')?.value

	if (!year || !month || !day) {
		throw new Error(`Could not format calendar date for ${timeZone}.`)
	}

	return `${year}-${month}-${day}`
}

const utcMidnightFromCalendarDate = (ymd: string): Date => {
	const [year, month, day] = ymd.split('-').map(Number)

	return new Date(Date.UTC(year, month - 1, day))
}

const addCalendarDays = (ymd: string, days: number): string => {
	const utc = utcMidnightFromCalendarDate(ymd)

	return new Date(utc.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10)
}

const addCalendarYears = (ymd: string, years: number): string => {
	const [year, month, day] = ymd.split('-').map(Number)
	const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate()
	const nextDay = Math.min(day, lastDay)

	return `${year + years}-${String(month).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
}

const addSubscriptionPeriod = (
	ymd: string,
	periodDays: number,
): string =>
	periodDays % 365 === 0
		? addCalendarYears(ymd, periodDays / 365)
		: addCalendarDays(ymd, periodDays)

const calendarDaysBetween = (fromYmd: string, toYmd: string): number => {
	const from = utcMidnightFromCalendarDate(fromYmd)
	const to = utcMidnightFromCalendarDate(toYmd)

	return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

const remainingSubscriptionDays = (
	renewalDate: Date,
	now: Date,
	timeZone: string,
): number =>
	calendarDaysBetween(
		calendarDateInTimeZone(now, timeZone),
		calendarDateInTimeZone(renewalDate, timeZone),
	)

const cloneSubscription = (
	subscription: TenantSubscription,
): TenantSubscription => ({
	...subscription,
	startDate: new Date(subscription.startDate),
	renewalDate: new Date(subscription.renewalDate),
	lastRenewalDate: subscription.lastRenewalDate
		? new Date(subscription.lastRenewalDate)
		: null,
	createdAt: new Date(subscription.createdAt),
	updatedAt: new Date(subscription.updatedAt),
})

export const createSubscription = (
	registeredAt: Date,
	now: Date,
	config: SubscriptionLifecycleConfig,
): TenantSubscription => {
	const today = calendarDateInTimeZone(now, config.timeZone)
	const startYmd = calendarDateInTimeZone(registeredAt, config.timeZone)
	let renewalYmd = addSubscriptionPeriod(startYmd, config.periodDays)

	// note: tenants already past their first period get a fresh window from today. Upgrade to createdAt-based arrears if historical billing matters.
	if (renewalYmd <= today) {
		renewalYmd = addSubscriptionPeriod(today, config.periodDays)

		return {
			startDate: utcMidnightFromCalendarDate(today),
			renewalDate: utcMidnightFromCalendarDate(renewalYmd),
			status: SUBSCRIPTION_STATUS.ACTIVE,
			renewalEnabled: true,
			lastRenewalDate: null,
			notifiedForDate: null,
			createdAt: now,
			updatedAt: now,
		}
	}

	return {
		startDate: utcMidnightFromCalendarDate(startYmd),
		renewalDate: utcMidnightFromCalendarDate(renewalYmd),
		status: SUBSCRIPTION_STATUS.ACTIVE,
		renewalEnabled: true,
		lastRenewalDate: null,
		notifiedForDate: null,
		createdAt: now,
		updatedAt: now,
	}
}

const nextRenewalCalendarDate = (
	currentRenewalYmd: string,
	todayYmd: string,
	periodDays: number,
): string => {
	const next = addSubscriptionPeriod(currentRenewalYmd, periodDays)

	if (next > todayYmd) {
		return next
	}

	return addSubscriptionPeriod(todayYmd, periodDays)
}

export const renewSubscription = (
	subscription: TenantSubscription,
	now: Date,
	config: SubscriptionLifecycleConfig,
): TenantSubscription => {
	const today = calendarDateInTimeZone(now, config.timeZone)
	const currentRenewal = calendarDateInTimeZone(
		subscription.renewalDate,
		config.timeZone,
	)
	const nextRenewal = nextRenewalCalendarDate(
		currentRenewal,
		today,
		config.periodDays,
	)

	return {
		...cloneSubscription(subscription),
		renewalDate: utcMidnightFromCalendarDate(nextRenewal),
		status: SUBSCRIPTION_STATUS.ACTIVE,
		lastRenewalDate: now,
		notifiedForDate: null,
		updatedAt: now,
	}
}

export const toSubscriptionView = (
	subscription: TenantSubscription,
	now: Date,
	config: Pick<SubscriptionLifecycleConfig, 'warningDays' | 'timeZone'>,
): SubscriptionView => {
	const remainingDays = remainingSubscriptionDays(
		subscription.renewalDate,
		now,
		config.timeZone,
	)
	const expired = remainingDays <= 0
	const warning =
		!expired && remainingDays > 0 && remainingDays <= config.warningDays

	return {
		startDate: calendarDateInTimeZone(subscription.startDate, config.timeZone),
		renewalDate: calendarDateInTimeZone(
			subscription.renewalDate,
			config.timeZone,
		),
		lastRenewalDate: subscription.lastRenewalDate
			? calendarDateInTimeZone(subscription.lastRenewalDate, config.timeZone)
			: null,
		status: expired ? SUBSCRIPTION_STATUS.EXPIRED : subscription.status,
		renewalEnabled: subscription.renewalEnabled,
		remainingDays,
		warning,
		urgent: remainingDays === 1,
		expired,
	}
}

type SubscriptionTick = {
	subscription: TenantSubscription
	view: SubscriptionView
	deactivateTenant: boolean
	changed: boolean
}

export const tickSubscription = (
	subscription: TenantSubscription,
	now: Date,
	config: SubscriptionLifecycleConfig,
): SubscriptionTick => {
	const next = cloneSubscription(subscription)
	const view = toSubscriptionView(next, now, config)
	const today = calendarDateInTimeZone(now, config.timeZone)
	let changed = false

	if (view.expired) {
		if (next.status !== SUBSCRIPTION_STATUS.EXPIRED) {
			next.status = SUBSCRIPTION_STATUS.EXPIRED
			changed = true
		}

		if (next.notifiedForDate !== today) {
			next.notifiedForDate = today
			changed = true
		}

		if (changed) {
			next.updatedAt = now
		}

		return {
			subscription: next,
			view: { ...view, status: SUBSCRIPTION_STATUS.EXPIRED },
			deactivateTenant: true,
			changed,
		}
	}

	if (view.warning && next.notifiedForDate !== today) {
		next.notifiedForDate = today
		next.updatedAt = now
		changed = true
	}

	return {
		subscription: next,
		view,
		deactivateTenant: false,
		changed,
	}
}
