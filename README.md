# storePlatform

### TO_DO

- remove isInternal and use the role to set the access :CHECK
- make the future base on tenant :CHECK
- do update the mongo db patch document and others like the getDocument
- by adding new product=> check the name and barcode immediately when the user write it
- make the currencies by default on dollar and the user can set the exchange
- update the login logic that the user login one time then he has only to writ the password
- user get popup about new updates (releases) (by click on 'understand' not show again)
- user get warning popup about expired of the apo (use cron-job to render it again every day for 30 day before expired date)
- check about offline get data from mongodb (user need internet once morning then fetch all data then can work offline then at end of day need internet to push all changes)
