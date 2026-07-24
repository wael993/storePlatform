/**
 * Self-check for the weighted moving-average cost formula used by
 * applyPurchaseInventoryAdjustments (see api.controller.ts). Pure math, no DB.
 * Run with: npx ts-node src/scripts/check-moving-average-cost.ts
 */
import ProductController from '../apis/api.controller'

const controller = new ProductController({} as any, {} as any) as unknown as {
	computeMovingAverageCost: (
		currentQuantity: number,
		currentAverageCost: number,
		purchaseQuantity: number,
		purchaseUnitPrice: number,
	) => number
}

const assertClose = (actual: number, expected: number, label: string) => {
	if (Math.abs(actual - expected) > 1e-9) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`)
	}

	console.log(`ok: ${label} -> ${actual}`)
}

// First-ever purchase of a product: no prior stock, average = purchase price.
assertClose(
	controller.computeMovingAverageCost(0, 0, 10, 5),
	5,
	'first purchase',
)

// Blend: 10 units @ 5 already in stock, buy 10 more @ 7 -> (10*5 + 10*7) / 20 = 6.
assertClose(
	controller.computeMovingAverageCost(10, 5, 10, 7),
	6,
	'blended average',
)

// Uneven quantities: 3 @ 10, buy 1 @ 2 -> (3*10 + 1*2) / 4 = 8.
assertClose(
	controller.computeMovingAverageCost(3, 10, 1, 2),
	8,
	'uneven quantities',
)

// ponytail ceiling: negative current stock (oversold) falls back to treating
// prior quantity as 0, so the average resets to the new purchase price.
assertClose(
	controller.computeMovingAverageCost(-5, 20, 10, 4),
	4,
	'negative current stock falls back to purchase price',
)

console.log('All moving-average cost checks passed.')
