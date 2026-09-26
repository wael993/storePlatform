import type { ComponentType } from 'react'
import type { IconProps } from '@chakra-ui/react'
import { FiUserPlus } from 'react-icons/fi'
import { CashBalanceIcon } from '../../icons/CashBalance'
import { InvoiceIcon } from '../../icons/Invoice'
import { WalletIcon } from '../../icons/Wallet'
import { CubeIcon } from '../../shared/icons/Cube'
import { LayerGroupIcon } from '../../shared/icons/LayerGroup'
import { PersonIcon } from '../../shared/icons/Person'
import { PriceTagIcon } from '../../shared/icons/PriceTag'
import type { OverviewKpiId } from '../../shared/dashboardShell'
import { RentIcon } from '../../shared/icons/Rent'

export type KpiTrendDirection = 'up' | 'down'

export interface OverviewKpiVisual {
	Icon: ComponentType<IconProps>
	value: string
	trend: { direction: KpiTrendDirection; delta: string }
}

/** Mock visuals for Coming Soon overview cards (DASH-004 / DASH-009 mock). */
export const OVERVIEW_KPI_VISUALS: Record<OverviewKpiId, OverviewKpiVisual> = {
	products: {
		Icon: CubeIcon,
		value: '842',
		trend: { direction: 'up', delta: '+12' },
	},
	registeredCustomers: {
		Icon: PersonIcon,
		value: '1,284',
		trend: { direction: 'up', delta: '+8' },
	},
	newCustomers: {
		Icon: FiUserPlus as ComponentType<IconProps>,
		value: '36',
		trend: { direction: 'up', delta: '+5' },
	},
	inventoryCost: {
		Icon: LayerGroupIcon,
		value: '48,920',
		trend: { direction: 'down', delta: '-2.4%' },
	},
	invoicesToday: {
		Icon: InvoiceIcon,
		value: '27',
		trend: { direction: 'up', delta: '+4' },
	},
	salesToday: {
		Icon: RentIcon,
		value: '3,450',
		trend: { direction: 'up', delta: '+11%' },
	},
	profit: {
		Icon: PriceTagIcon,
		value: '890',
		trend: { direction: 'down', delta: '-3%' },
	},
	totalReceivable: {
		Icon: WalletIcon,
		value: '12,400',
		trend: { direction: 'up', delta: '+620' },
	},
	cashBalance: {
		Icon: CashBalanceIcon,
		value: '5,210',
		trend: { direction: 'down', delta: '-180' },
	},
}
