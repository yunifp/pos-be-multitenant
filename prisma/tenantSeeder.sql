DO $$ 
DECLARE
    v_tenant_id TEXT := gen_random_uuid()::TEXT;
    v_role_id TEXT := gen_random_uuid()::TEXT;
    v_warehouse_id TEXT := gen_random_uuid()::TEXT;
    v_branch_id TEXT := gen_random_uuid()::TEXT;
    v_user_id TEXT := gen_random_uuid()::TEXT;
    
    v_perm_order_create TEXT := gen_random_uuid()::TEXT;
    v_perm_order_read TEXT := gen_random_uuid()::TEXT;
    v_perm_inv_create TEXT := gen_random_uuid()::TEXT;
    v_perm_inv_read TEXT := gen_random_uuid()::TEXT;
    v_perm_fin_read TEXT := gen_random_uuid()::TEXT;
    v_perm_set_update TEXT := gen_random_uuid()::TEXT;

    v_material_kopi_id TEXT := gen_random_uuid()::TEXT;
    v_material_susu_id TEXT := gen_random_uuid()::TEXT;
    v_material_cup_id TEXT := gen_random_uuid()::TEXT;

    v_category_id INT;
    v_product_id INT;
    v_variant_id INT;
BEGIN
    RAISE NOTICE '🌱 Memulai proses seeding...';

    -- 1. Hapus data lama (opsional, hati-hati jika di production)
    DELETE FROM tenants;
    DELETE FROM permissions;

    -- 2. Buat Data Tenant Awal
    INSERT INTO tenants (id, name, email, phone, is_active, active_features, created_at, updated_at)
    VALUES (v_tenant_id, 'EPS Kopi Nusantara', 'admin@gmail.com', '081234567890', true, ARRAY['INVENTORY', 'QUEUE', 'PAYMENT_GATEWAY'], NOW(), NOW());
    RAISE NOTICE '✅ Tenant dibuat: EPS Kopi Nusantara';

    -- 3. Setup Permissions (Hak Akses Master)
    INSERT INTO permissions (id, module, action, code, description) VALUES
    (v_perm_order_create, 'ORDER', 'CREATE', 'ORDER_CREATE', 'Membuat pesanan baru'),
    (v_perm_order_read, 'ORDER', 'READ', 'ORDER_READ', 'Melihat riwayat pesanan'),
    (v_perm_inv_create, 'INVENTORY', 'CREATE', 'INVENTORY_CREATE', 'Menambah bahan baku & stok'),
    (v_perm_inv_read, 'INVENTORY', 'READ', 'INVENTORY_READ', 'Melihat stok gudang dan cabang'),
    (v_perm_fin_read, 'FINANCE', 'READ', 'FINANCE_READ', 'Melihat laporan keuangan dan cashflow'),
    (v_perm_set_update, 'SETTINGS', 'UPDATE', 'SETTINGS_UPDATE', 'Mengubah pengaturan sistem');
    RAISE NOTICE '✅ Permissions master dibuat';

    -- 4. Setup Role (OWNER) dan Assign semua Permissions
    INSERT INTO roles (id, tenant_id, name, description)
    VALUES (v_role_id, v_tenant_id, 'Owner', 'Akses penuh ke seluruh sistem');

    INSERT INTO role_permissions (id, role_id, permission_id) VALUES
    (gen_random_uuid()::TEXT, v_role_id, v_perm_order_create),
    (gen_random_uuid()::TEXT, v_role_id, v_perm_order_read),
    (gen_random_uuid()::TEXT, v_role_id, v_perm_inv_create),
    (gen_random_uuid()::TEXT, v_role_id, v_perm_inv_read),
    (gen_random_uuid()::TEXT, v_role_id, v_perm_fin_read),
    (gen_random_uuid()::TEXT, v_role_id, v_perm_set_update);
    RAISE NOTICE '✅ Role dibuat: Owner';

    -- 5. Setup Pengaturan Umum (General Setting)
    INSERT INTO general_settings (id, tenant_id, app_name, store_name, tax_rate, service_charge_rate, currency_symbol, "pointsPerAmount", "pointValue", "updatedAt")
    VALUES (gen_random_uuid()::TEXT, v_tenant_id, 'EPS POS', 'EPS Kopi Nusantara', 11.0, 5.0, 'Rp', 10000, 1, NOW());

    -- 6. Setup Gudang (Warehouse) dan Cabang (Branch)
    INSERT INTO warehouses (id, tenant_id, name, address)
    VALUES (v_warehouse_id, v_tenant_id, 'Gudang Utama Pusat', 'Jl. Gudang Kopi No. 1, Bandung');

    INSERT INTO branches (id, tenant_id, name, address, phone, enable_order_queue, created_at, updated_at)
    VALUES (v_branch_id, v_tenant_id, 'Cabang Utama Dago', 'Jl. Ir. H. Juanda No. 99, Bandung', '022-1234567', true, NOW(), NOW());
    RAISE NOTICE '✅ Gudang dan Cabang dibuat';

    -- 7. Setup Pengaturan Struk & Payment untuk Cabang
    INSERT INTO receipt_settings (id, branch_id, document_format, store_name, footer_message, due_days_default, paper_width)
    VALUES (gen_random_uuid()::TEXT, v_branch_id, 'RECEIPT', 'EPS KOPI DAGO', 'Terima kasih atas kunjungan Anda!', 0, 58);

    INSERT INTO payment_integrations (id, branch_id, channel_type, is_production)
    VALUES (gen_random_uuid()::TEXT, v_branch_id, 'BASIC', false);

    -- 8. Buat User Admin (Owner)
    -- Menggunakan representasi string dari hash Argon2 untuk "password123"
    INSERT INTO users (id, tenant_id, branch_id, role_id, email, password_hash, full_name, job_position, is_active, created_at, updated_at)
    VALUES (v_user_id, v_tenant_id, v_branch_id, v_role_id, 'owner@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$2q5sA3h5K8r/b+u0M0dCgw$E+8C/l4XyK8L5zPzW0hGz6pP2uT4zHwJ0Qe2bM0y5R8', 'Owner', 'OWNER', true, NOW(), NOW());
    RAISE NOTICE '✅ User dibuat: owner@gmail.com (Password: password123)';

    -- 9. Setup Inventory Master (Bahan Baku)
    INSERT INTO materials (id, tenant_id, name, unit, cost_per_unit) VALUES
    (v_material_kopi_id, v_tenant_id, 'Biji Kopi Arabica', 'Gram', 200),
    (v_material_susu_id, v_tenant_id, 'Susu UHT Full Cream', 'Mililiter', 20),
    (v_material_cup_id, v_tenant_id, 'Gelas Cup Plastik 16oz', 'Pcs', 1500);
    RAISE NOTICE '✅ Master Bahan Baku (Materials) dibuat';

    -- Inject Stok Awal ke Gudang Pusat
    INSERT INTO warehouse_stocks (id, warehouse_id, material_id, quantity) VALUES
    (gen_random_uuid()::TEXT, v_warehouse_id, v_material_kopi_id, 10000),
    (gen_random_uuid()::TEXT, v_warehouse_id, v_material_susu_id, 20000),
    (gen_random_uuid()::TEXT, v_warehouse_id, v_material_cup_id, 1000);

    -- Inject Stok Awal ke Cabang Dago
    INSERT INTO branch_material_stocks (id, branch_id, material_id, quantity) VALUES
    (gen_random_uuid()::TEXT, v_branch_id, v_material_kopi_id, 2000),
    (gen_random_uuid()::TEXT, v_branch_id, v_material_susu_id, 5000),
    (gen_random_uuid()::TEXT, v_branch_id, v_material_cup_id, 200);
    RAISE NOTICE '✅ Stok Awal Gudang & Cabang disiapkan';

    -- 10. Setup Kategori & Produk
    INSERT INTO categories (tenant_id, name, is_active)
    VALUES (v_tenant_id, 'Kopi Susu', true) RETURNING id INTO v_category_id;

    INSERT INTO products (tenant_id, branch_id, category_id, name)
    VALUES (v_tenant_id, NULL, v_category_id, 'Kopi Susu Gula Aren') RETURNING id INTO v_product_id;

    INSERT INTO product_variants (product_id, name, price)
    VALUES (v_product_id, 'Reguler (16oz)', 25000) RETURNING id INTO v_variant_id;

    -- 11. Setup Resep (BOM)
    INSERT INTO recipes (id, variant_id, material_id, quantity_required) VALUES
    (gen_random_uuid()::TEXT, v_variant_id, v_material_kopi_id, 18),
    (gen_random_uuid()::TEXT, v_variant_id, v_material_susu_id, 150),
    (gen_random_uuid()::TEXT, v_variant_id, v_material_cup_id, 1);
    RAISE NOTICE '✅ Produk, Varian, dan Resep (BOM) berhasil dikonfigurasi';

    RAISE NOTICE '🎉 Seeding Selesai!';
END $$;