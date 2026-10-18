import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler'
import ProductController from './apis/api.controller'
import CustomerController from './apis/customer/api.controller'
import CustomerRoutes from './apis/customer/api.routes'
import SupplierController from './apis/supplier/api.controller'
import SupplierRoutes from './apis/supplier/api.routes'
import ProjectController from './apis/project/api.controller'
import ProjectRoutes from './apis/project/api.routes'
import CategoryController from './apis/category/api.controller'
import CategoryRoutes from './apis/category/api.routes'
import PartnerController from './apis/partner/api.controller'
import PartnerRoutes from './apis/partner/api.routes'
import SettingController from './apis/setting/api.controller'
import SettingRoutes from './apis/setting/api.routes'
import TenantController from './apis/tenant/api.controller'
import TenantRoutes from './apis/tenant/api.routes'
import SellingInvoiceController from './apis/selling-invoice/api.controller'
import SellingInvoiceRoutes from './apis/selling-invoice/api.routes'
import BuyingInvoiceController from './apis/buying-invoice/api.controller'
import BuyingInvoiceRoutes from './apis/buying-invoice/api.routes'
import ReportController from './apis/report/api.controller'
import ReportRoutes from './apis/report/api.routes'
import ProductImportController from './apis/product-import/api.controller'
import ProductImportRoutes from './apis/product-import/api.routes'
import StoreRoutes from './apis/api.routes'
import EmployeeController from './apis/employee/api.controller'
import EmployeeRoutes from './apis/employee/api.routes'
import NotificationController from './apis/notification/api.controller'
import NotificationRoutes from './apis/notification/api.routes'
import NewsroomController from './apis/newsroom/api.controller'
import NewsroomRoutes from './apis/newsroom/api.routes'
import MongodbController from './shared/mongodb/mongodbController'
import ProductsMapper from './apis/mappings/ProductsMapper'
// import { requestLogger } from './middleware/middleware'

export const createApp = () => {
	const mongoDbClient = new MongodbController()
	const productsMapper = new ProductsMapper()

	const productController = new ProductController(productsMapper, mongoDbClient)
	const customerController = new CustomerController(
		mongoDbClient,
		productController,
	)

	productController.setCustomerController(customerController)

	const supplierController = new SupplierController(
		mongoDbClient,
		productController,
	)

	productController.setSupplierController(supplierController)

	const projectController = new ProjectController(
		mongoDbClient,
		productController,
	)

	productController.setProjectController(projectController)

	const categoryController = new CategoryController(mongoDbClient)

	productController.setCategoryController(categoryController)

	const partnerController = new PartnerController(
		mongoDbClient,
		productController,
	)

	productController.setPartnerController(partnerController)

	const settingController = new SettingController(
		productController,
		mongoDbClient,
	)

	productController.setSettingController(settingController)

	const tenantController = new TenantController(mongoDbClient)

	const sellingInvoiceController = new SellingInvoiceController(
		mongoDbClient,
		productController,
	)

	productController.setSellingInvoiceController(sellingInvoiceController)

	const buyingInvoiceController = new BuyingInvoiceController(
		mongoDbClient,
		productController,
	)

	productController.setBuyingInvoiceController(buyingInvoiceController)

	const employeeController = new EmployeeController()
	const employeeRoutes = new EmployeeRoutes(
		employeeController,
		productController,
	)
	const customerRoutes = new CustomerRoutes(
		customerController,
		productController,
	)
	const supplierRoutes = new SupplierRoutes(
		supplierController,
		productController,
	)
	const projectRoutes = new ProjectRoutes(projectController, productController)
	const categoryRoutes = new CategoryRoutes(
		categoryController,
		productController,
	)
	const partnerRoutes = new PartnerRoutes(partnerController, productController)
	const settingRoutes = new SettingRoutes(settingController, productController)
	const tenantRoutes = new TenantRoutes(tenantController, productController)
	const sellingInvoiceRoutes = new SellingInvoiceRoutes(
		sellingInvoiceController,
		productController,
	)
	const buyingInvoiceRoutes = new BuyingInvoiceRoutes(
		buyingInvoiceController,
		productController,
	)
	const reportController = new ReportController(mongoDbClient)
	const reportRoutes = new ReportRoutes(reportController, productController)
	const productImportController = new ProductImportController(productController)
	const productImportRoutes = new ProductImportRoutes(
		productImportController,
		productController,
	)
	const storeRoutes = new StoreRoutes(productController)
	const notificationController = new NotificationController()
	const notificationRoutes = new NotificationRoutes(
		notificationController,
		productController,
	)
	const newsroomController = new NewsroomController()
	const newsroomRoutes = new NewsroomRoutes(
		newsroomController,
		productController,
	)
	const app = express()

	const jsonParser = express.json({ limit: '100kb' })
	const extractJsonParser = express.json({ limit: '12mb' })
	const productImportJsonParser = express.json({ limit: '45mb' })
	const invoiceSettingsJsonParser = express.json({ limit: '2mb' })

	app.use((req, res, next) => {
		if (req.path.includes('/buying-invoices/extract')) {
			return extractJsonParser(req, res, next)
		}

		if (req.path.includes('/product-import/parse')) {
			return productImportJsonParser(req, res, next)
		}

		if (req.path.includes('/invoice-settings')) {
			return invoiceSettingsJsonParser(req, res, next)
		}

		if (req.path.includes('/newsroom')) {
			// note: 12mb covers ~8 screenshots at 1.2MB (base64). Upgrade: object storage.
			return extractJsonParser(req, res, next)
		}

		return jsonParser(req, res, next)
	})

	app.use(cookieParser())

	//TODO: improve this middleware to see the logger better in the requestLogger
	// app.use(requestLogger)

	app.use(
		cors({
			origin: process.env.FRONTEND_URL || 'http://localhost:3000',
			credentials: true,
		}),
	)

	employeeRoutes.setRoutes(app)
	customerRoutes.setRoutes(app)
	supplierRoutes.setRoutes(app)
	projectRoutes.setRoutes(app)
	categoryRoutes.setRoutes(app)
	partnerRoutes.setRoutes(app)
	settingRoutes.setRoutes(app)
	sellingInvoiceRoutes.setRoutes(app)
	buyingInvoiceRoutes.setRoutes(app)
	reportRoutes.setRoutes(app)
	productImportRoutes.setRoutes(app)
	notificationRoutes.setRoutes(app)
	newsroomRoutes.setRoutes(app)
	storeRoutes.setRoutes(app)
	tenantRoutes.setRoutes(app)

	app.use(errorHandler)

	return app
}
