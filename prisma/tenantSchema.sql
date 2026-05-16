-- ==========================================
-- CREATE ENUMS
-- ==========================================
CREATE TYPE "JobPosition" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'KITCHEN_STAFF', 'WAITER', 'BARISTA', 'WAREHOUSE_STAFF');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'PARTIAL');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'CARD', 'TRANSFER', 'MARKETPLACE', 'MIDTRANS', 'COMPLIMENTARY');
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'NOON', 'NIGHT');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'PERMIT');
CREATE TYPE "CashFlowType" AS ENUM ('INCOME_SALES', 'INCOME_OTHER', 'EXPENSE_MATERIAL', 'EXPENSE_OPERATIONAL', 'EXPENSE_OTHER');
CREATE TYPE "PromotionType" AS ENUM ('TRANSACTION', 'PRODUCT_DISCOUNT', 'BUNDLE');
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKE_HOME', 'ONLINE');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PointType" AS ENUM ('EARNED', 'REDEEMED', 'REFUNDED', 'ADJUSTMENT');
CREATE TYPE "DocumentFormat" AS ENUM ('RECEIPT', 'INVOICE');
CREATE TYPE "DistributionStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
CREATE TYPE "PaymentChannel" AS ENUM ('BASIC', 'GATEWAY');

-- ==========================================
-- CREATE TABLES
-- ==========================================

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "external_plan_id" TEXT,
    "active_features" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "general_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_name" TEXT NOT NULL DEFAULT 'EPS POS',
    "store_name" TEXT NOT NULL,
    "logo_url" TEXT,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "service_charge_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency_symbol" TEXT NOT NULL DEFAULT 'Rp',
    "pointsPerAmount" INTEGER NOT NULL DEFAULT 10000,
    "pointValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "general_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "enable_order_queue" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "receipt_settings" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "document_format" "DocumentFormat" NOT NULL DEFAULT 'RECEIPT',
    "invoice_prefix" TEXT,
    "due_days_default" INTEGER NOT NULL DEFAULT 0,
    "terms_and_conditions" TEXT,
    "store_name" TEXT,
    "footer_message" TEXT,
    "paper_width" INTEGER NOT NULL DEFAULT 58,
    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_integrations" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "channel_type" "PaymentChannel" NOT NULL DEFAULT 'BASIC',
    "midtrans_server_key" TEXT,
    "midtrans_client_key" TEXT,
    "is_production" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "payment_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branch_payment_methods" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL DEFAULT 'BASIC',
    "feePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "feeFlat" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "branch_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "role_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "job_position" "JobPosition" NOT NULL DEFAULT 'CASHIER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "cost_per_unit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouse_stocks" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branch_material_stocks" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
    CONSTRAINT "branch_material_stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_distributions" (
    "id" TEXT NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "dest_branch_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    CONSTRAINT "material_distributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_distribution_items" (
    "id" TEXT NOT NULL,
    "distribution_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    CONSTRAINT "material_distribution_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity_required" DECIMAL(15,3) NOT NULL,
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "payment_method" TEXT,
    "payment_channel" "PaymentChannel" NOT NULL DEFAULT 'BASIC',
    "payment_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "order_type" "OrderType" NOT NULL DEFAULT 'DINE_IN',
    "midtrans_transaction_id" TEXT,
    "member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_flows" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "reference_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT NOT NULL,
    CONSTRAINT "cash_flows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ShiftType" NOT NULL DEFAULT 'MORNING',
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_shifts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    CONSTRAINT "employee_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "date" DATE NOT NULL,
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "photo_url" TEXT,
    "location" TEXT,
    "notes" TEXT,
    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL DEFAULT 'TRANSACTION',
    "discount_pct" INTEGER,
    "discount_amt" DECIMAL(15,2),
    "min_purchase" DECIMAL(15,2) DEFAULT 0,
    "max_discount" DECIMAL(15,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotion_targets" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "promotion_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_promotions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL,
    CONSTRAINT "order_promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_point_histories" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "PointType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_point_histories_pkey" PRIMARY KEY ("id")
);

-- Implicit Many-to-Many Table for Branch & Promotion
CREATE TABLE "_PromoAvailability" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- ==========================================
-- INDEXES & UNIQUE CONSTRAINTS
-- ==========================================

CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE UNIQUE INDEX "general_settings_tenant_id_key" ON "general_settings"("tenant_id");
CREATE UNIQUE INDEX "receipt_settings_branch_id_key" ON "receipt_settings"("branch_id");
CREATE UNIQUE INDEX "payment_integrations_branch_id_key" ON "payment_integrations"("branch_id");
CREATE UNIQUE INDEX "branch_payment_methods_branch_id_name_key" ON "branch_payment_methods"("branch_id", "name");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "warehouse_stocks_warehouse_id_material_id_key" ON "warehouse_stocks"("warehouse_id", "material_id");
CREATE UNIQUE INDEX "branch_material_stocks_branch_id_material_id_key" ON "branch_material_stocks"("branch_id", "material_id");
CREATE UNIQUE INDEX "recipes_variant_id_material_id_key" ON "recipes"("variant_id", "material_id");
CREATE UNIQUE INDEX "orders_invoice_number_key" ON "orders"("invoice_number");
CREATE INDEX "cash_flows_branch_id_type_date_idx" ON "cash_flows"("branch_id", "type", "date");
CREATE UNIQUE INDEX "employee_shifts_user_id_date_key" ON "employee_shifts"("user_id", "date");
CREATE INDEX "attendances_user_id_clock_in_idx" ON "attendances"("user_id", "clock_in");
CREATE UNIQUE INDEX "refund_requests_order_id_key" ON "refund_requests"("order_id");
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");
CREATE INDEX "promotions_code_idx" ON "promotions"("code");
CREATE UNIQUE INDEX "_PromoAvailability_AB_unique" ON "_PromoAvailability"("A", "B");
CREATE INDEX "_PromoAvailability_B_index" ON "_PromoAvailability"("B");
CREATE UNIQUE INDEX "members_phone_key" ON "members"("phone");
CREATE INDEX "members_phone_idx" ON "members"("phone");

-- ==========================================
-- FOREIGN KEYS
-- ==========================================

ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "general_settings" ADD CONSTRAINT "general_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "receipt_settings" ADD CONSTRAINT "receipt_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_integrations" ADD CONSTRAINT "payment_integrations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branch_payment_methods" ADD CONSTRAINT "branch_payment_methods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "materials" ADD CONSTRAINT "materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branch_material_stocks" ADD CONSTRAINT "branch_material_stocks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_material_stocks" ADD CONSTRAINT "branch_material_stocks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_distributions" ADD CONSTRAINT "material_distributions_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_distributions" ADD CONSTRAINT "material_distributions_dest_branch_id_fkey" FOREIGN KEY ("dest_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_distributions" ADD CONSTRAINT "material_distributions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_distribution_items" ADD CONSTRAINT "material_distribution_items_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "material_distributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_distribution_items" ADD CONSTRAINT "material_distribution_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recipes" ADD CONSTRAINT "recipes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_flows" ADD CONSTRAINT "cash_flows_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "members" ADD CONSTRAINT "members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_point_histories" ADD CONSTRAINT "member_point_histories_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_point_histories" ADD CONSTRAINT "member_point_histories_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_PromoAvailability" ADD CONSTRAINT "_PromoAvailability_A_fkey" FOREIGN KEY ("A") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PromoAvailability" ADD CONSTRAINT "_PromoAvailability_B_fkey" FOREIGN KEY ("B") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;





