# Backend Setup Instructions

## Prerequisites
- MySQL 8.x installed and running
- Node.js 18+ installed

## Database Setup

### Option 1: Using schema.sql (Recommended for Production)
1. Create a MySQL database named `soju_1hustle`:
   ```sql
   CREATE DATABASE soju_1hustle;
   ```

2. Run the schema.sql file to create all tables and seed data:
   ```bash
   mysql -u user -p soju_1hustle < schema.sql
   ```

### Option 2: Using Prisma (Development)
1. Update the DATABASE_URL in `.env` file with your MySQL credentials:
   ```
   DATABASE_URL=mysql://username:password@localhost:3306/soju_1hustle
   ```

2. Push the schema to the database:
   ```bash
   npm run prisma:push
   ```

3. Run the seed script to populate initial data:
   ```bash
   npm run prisma:seed
   ```

## Environment Variables
Update the `.env` file with your configuration:
```
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=soju_1hustle
PORT=4000
JWT_SECRET=your_secret_key_here
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=mysql://your_mysql_user:your_mysql_password@localhost:3306/soju_1hustle
```

## Running the Backend

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## Default User
After running the seed script, you can login with:
- Email: `admin@bukudapur.com`
- Password: `password123`

## API Endpoints
The backend will be available at `http://localhost:4000/api/v1`

### Authentication
- `POST /api/v1/auth/login` - Login to get JWT token
- `GET /api/v1/auth/me` - Get current user info

### Main Endpoints
- `GET /api/v1/dashboard/*` - Dashboard data
- `GET /api/v1/products` - Products CRUD
- `GET /api/v1/customers` - Customers CRUD
- `GET /api/v1/suppliers` - Suppliers CRUD
- `GET /api/v1/transactions` - Transactions management
- `GET /api/v1/stock` - Stock management
- `GET /api/v1/orders` - Orders management
- `GET /api/v1/reports/*` - Financial reports
- `GET /api/v1/audit-log` - Audit logs

## Troubleshooting

### Prisma Client Issues
If you encounter Prisma client issues, regenerate it:
```bash
npm run prisma:generate
```

### Database Connection Issues
1. Verify MySQL is running
2. Check credentials in `.env` file
3. Ensure the database exists

### Port Already in Use
If port 4000 is already in use, change the PORT in `.env` file.