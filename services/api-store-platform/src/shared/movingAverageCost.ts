/** note: mongo $let is the source of truth. Upgrade: assert via a purchase integration test. */
export const purchaseAverageCostExpression = (
	purchaseQuantity: number,
	purchaseUnitPrice: number,
) => ({
	$let: {
		vars: {
			priorQty: {
				$max: [0, { $ifNull: ['$quantity', 0] }],
			},
			priorAvg: {
				$ifNull: ['$averageCost', purchaseUnitPrice],
			},
		},
		in: {
			$cond: [
				{
					$lte: [{ $add: ['$$priorQty', purchaseQuantity] }, 0],
				},
				purchaseUnitPrice,
				{
					$divide: [
						{
							$add: [
								{
									$multiply: ['$$priorQty', '$$priorAvg'],
								},
								purchaseQuantity * purchaseUnitPrice,
							],
						},
						{ $add: ['$$priorQty', purchaseQuantity] },
					],
				},
			],
		},
	},
})
