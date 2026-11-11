-- JOY University Green Campus feature tables (additive; existing data is preserved)
CREATE TABLE IF NOT EXISTS green_points (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id BIGINT NOT NULL UNIQUE REFERENCES collection_requests(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS green_points_user_created_idx ON green_points(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS craft_products (
  id BIGSERIAL PRIMARY KEY,
  product_name VARCHAR(160) NOT NULL,
  material_used VARCHAR(160) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE craft_sales ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES craft_products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS craft_products_stock_name_idx ON craft_products(stock, product_name);
CREATE INDEX IF NOT EXISTS craft_sales_sold_on_idx ON craft_sales(sold_on DESC);
