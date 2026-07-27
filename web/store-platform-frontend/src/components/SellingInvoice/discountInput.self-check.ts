import { parseDiscountInput } from './discountInput'

const assert = (label: string, condition: boolean) => {
	if (!condition) {
		throw new Error(`discountInput self-check failed: ${label}`)
	}
}

const percent = parseDiscountInput('10%')
assert('parses percent', percent?.discount === 10 && percent.discountIsPercent)

const fixed = parseDiscountInput('25.5')
assert('parses fixed', fixed?.discount === 25.5 && !fixed.discountIsPercent)

const empty = parseDiscountInput('')
assert(
	'empty is zero fixed',
	empty?.discount === 0 && !empty?.discountIsPercent,
)

assert('rejects invalid', parseDiscountInput('abc') === null)
