BEGIN;

DO $seed$
DECLARE
  seed_user_id CONSTANT text := 'user_349wJGAl66iA6ENUunzpfWLyERK';

  credit_item_id CONSTANT text := 'item_demo_chase_card';
  invest_item_id CONSTANT text := 'item_demo_vanguard';
  mortgage_item_id CONSTANT text := 'item_demo_river_mortgage';

  credit_account_id CONSTANT text := 'acct_demo_chase_sapphire';
  invest_account_id CONSTANT text := 'acct_demo_vanguard_brokerage';
  mortgage_account_id CONSTANT text := 'acct_demo_river_mortgage';

  credit_access_token CONSTANT text := 'bd1ce790e4737f9c2cc8780ad4b0dbf1:c42471f98a6e2cec9dc788b2f00988a0:b67e7cdb5db46130d5737bb6d286884aabcc84ad1e1e6a4994b4';
  invest_access_token CONSTANT text := 'd9238e64a5dac86a624acb4e8515fac2:bb321df286b3365e721f25864b2a2bb1:dfb4c51ec26825000d449e2446ce714686aa29e19a72e7f1eaeb';
  mortgage_access_token CONSTANT text := 'acf1cba8fc613871b34883a8db068277:051702da06f88632b82fb6f2e9916f06:345afa632bcd38a02928fe5a9748ac5acb60d68c2487efad8810674c';
BEGIN
  -- Clean existing rows for deterministic resets (child tables first)
  DELETE FROM transactions WHERE user_id = seed_user_id;
  DELETE FROM investment_holdings WHERE user_id = seed_user_id;
  DELETE FROM liabilities_credit WHERE user_id = seed_user_id;
  DELETE FROM liabilities_mortgage WHERE user_id = seed_user_id;
  DELETE FROM liabilities_student WHERE user_id = seed_user_id;

  DELETE FROM account_investment_sync_state
  WHERE account_id IN (credit_account_id, invest_account_id, mortgage_account_id);

  DELETE FROM account_sync_state
  WHERE account_id IN (credit_account_id, invest_account_id, mortgage_account_id);

  DELETE FROM net_worth_snapshots WHERE user_id = seed_user_id;
  DELETE FROM accounts WHERE user_id = seed_user_id;
  DELETE FROM plaid_connections WHERE user_id = seed_user_id;

  -- Plaid connections
  INSERT INTO plaid_connections (
    user_id,
    access_token_encrypted,
    item_id,
    connected_at,
    plaid_env,
    institution_name,
    status
  ) VALUES
    (seed_user_id, credit_access_token, credit_item_id, TIMESTAMPTZ '2024-11-02 09:15:00+00', 'sandbox', 'Chase', 'active'),
    (seed_user_id, invest_access_token, invest_item_id, TIMESTAMPTZ '2024-10-15 14:30:00+00', 'sandbox', 'Vanguard', 'active'),
    (seed_user_id, mortgage_access_token, mortgage_item_id, TIMESTAMPTZ '2023-05-01 12:00:00+00', 'sandbox', 'River City Mortgage', 'active');

  -- Accounts
  INSERT INTO accounts (
    user_id,
    item_id,
    account_id,
    name,
    official_name,
    type,
    subtype,
    current_balance,
    available_balance,
    limit_amount,
    currency_code,
    last_synced_at
  ) VALUES
    (
      seed_user_id,
      credit_item_id,
      credit_account_id,
      'Chase Sapphire Preferred',
      'Chase Sapphire Preferred Card',
      'credit',
      'credit card',
      2150.43,
      NULL,
      12000,
      'USD',
      now() - INTERVAL '12 hours'
    ),
    (
      seed_user_id,
      invest_item_id,
      invest_account_id,
      'Vanguard Brokerage',
      'Vanguard Personal Brokerage',
      'investment',
      'brokerage',
      48250.67,
      48250.67,
      NULL,
      'USD',
      now() - INTERVAL '1 day'
    ),
    (
      seed_user_id,
      mortgage_item_id,
      mortgage_account_id,
      'River City Mortgage',
      'River City 30-Year Fixed',
      'loan',
      'mortgage',
      364200.12,
      NULL,
      NULL,
      'USD',
      now() - INTERVAL '2 days'
    );

  -- Account sync state metadata
  INSERT INTO account_sync_state (
    account_id,
    transaction_cursor,
    last_synced_at,
    sync_status,
    total_transactions_synced
  ) VALUES
    (credit_account_id, 'cursor-demo-chase-0024', now() - INTERVAL '6 hours', 'complete', 84),
    (invest_account_id, 'invest-cursor-demo-0715', now() - INTERVAL '1 day', 'complete', 18),
    (mortgage_account_id, 'mortgage-cursor-demo-0201', now() - INTERVAL '3 days', 'complete', 24);

  INSERT INTO account_investment_sync_state (
    account_id,
    sync_status,
    last_synced_at,
    last_error,
    holdings_count
  ) VALUES (
    invest_account_id,
    'synced',
    now() - INTERVAL '1 day',
    NULL,
    3
  );

  -- Credit card transactions (sandbox-inspired sample with relative dates)
  WITH base_dates AS (
    SELECT (current_date - INTERVAL '60 days')::date AS start_date
  ),
  raw_transactions(day_offset, sequence, name, amount, category_text) AS (
    VALUES
      (0, 1, 'FASTRAK CSC', 8.00, '["Travel"]'),
      (0, 3, 'TST*A16 - CHESTNUT', 204.40, '["Food and Drink", "Restaurants"]'),
      (1, 4, 'CARMEL MISSION INN', 935.26, '["Travel"]'),
      (1, 5, 'TRATTORIA CONTADINA', 84.43, '["Food and Drink", "Restaurants"]'),
      (2, 6, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (2, 7, 'WAYMO', 29.39, '["Travel"]'),
      (3, 8, 'GOLDEN GATE DISP &amp;    Y', 39.59, '["Bills and Utilities"]'),
      (3, 9, 'ODYSSEY CHIROPRACTIC', 400.00, '["Health and Wellness"]'),
      (4, 10, 'DD *DOORDASH BONITATAQ', 27.15, '["Food and Drink", "Restaurants"]'),
      (4, 11, 'ODYSSEY CHIROPRACTIC', 200.00, '["Health and Wellness"]'),
      (5, 12, 'BARISTA', 8.96, '["Food and Drink", "Restaurants"]'),
      (5, 13, 'SP BROOKLINEN', 109.39, '["Home", "Supplies"]'),
      (6, 14, 'AMAZON MKTPL*G14I571W3', 47.62, '["Shops", "General Merchandise"]'),
      (6, 15, 'DD *DOORDASH SUPERDUPE', 25.94, '["Food and Drink", "Restaurants"]'),
      (7, 16, 'DD *DOORDASH POKEBOLA', 33.06, '["Food and Drink", "Restaurants"]'),
      (7, 17, 'SAFEWAY #1711', 12.49, '["Food and Drink", "Groceries"]'),
      (8, 18, 'DD *DOORDASH SENIORESP', 39.97, '["Food and Drink", "Restaurants"]'),
      (8, 19, 'SQ *RITUAL COFFEE ROASTER', 5.00, '["Food and Drink", "Restaurants"]'),
      (9, 20, 'DD *DOORDASH BONITATAQ', 27.15, '["Food and Drink", "Restaurants"]'),
      (9, 21, 'SP SKIING IS EASY', 40.50, '["Shops", "General Merchandise"]'),
      (10, 22, 'SHAKE SHACK D/E FC CLT', 17.51, '["Food and Drink", "Restaurants"]'),
      (10, 23, 'WENDY''S 11795', 21.11, '["Food and Drink", "Restaurants"]'),
      (11, 24, 'DARE COUNTY ABC #5', 129.31, '["Bills and Utilities"]'),
      (11, 25, 'WEE WINKS MARKET &amp; DEL', 65.94, '["Food and Drink", "Groceries"]'),
      (13, 26, 'HARRIS TEETER #0387', 73.15, '["Food and Drink", "Groceries"]'),
      (13, 27, 'PINE ISLAND POA INC', 10.00, '["Transfer", "Donations"]'),
      (14, 28, 'SP SAXX UNDERWEAR', 77.70, '["Shops", "General Merchandise"]'),
      (15, 29, 'DARE COUNTY ABC #5', 27.77, '["Bills and Utilities"]'),
      (15, 30, 'TST*EVENTIDE DUCK', 223.03, '["Food and Drink", "Restaurants"]'),
      (16, 31, 'CLAUDE.AI SUBSCRIPTION', 200.00, '["Shops", "General Merchandise"]'),
      (16, 32, 'ROYAL FARMS #471', 23.63, '["Travel", "Auto and Gas"]'),
      (17, 33, 'MIXT FILLMORE', 18.96, '["Food and Drink", "Restaurants"]'),
      (17, 34, 'ODYSSEY CHIROPRACTIC', 125.00, '["Health and Wellness"]'),
      (18, 35, 'COOKUNITY INC', 90.03, '["Food and Drink", "Groceries"]'),
      (18, 36, 'TST*CHEZ MAMAN', 126.19, '["Food and Drink", "Restaurants"]'),
      (19, 37, 'MARINA SUPERMARKET', 15.37, '["Food and Drink", "Groceries"]'),
      (19, 38, 'Payment Thank You-Mobile', -3000.00, '["Transfer", "Credit Card"]'),
      (19, 39, 'SQ *REVEILLE COFFEE CO.', 13.40, '["Food and Drink", "Restaurants"]'),
      (20, 40, 'DD *DOORDASH BONITATAQ', 27.15, '["Food and Drink", "Restaurants"]'),
      (20, 41, 'LS ROARINGMOUSE CYCLES', 40.85, '["Shops", "General Merchandise"]'),
      (21, 42, 'SQ *I''A POKE - FILLMORE S', 22.76, '["Food and Drink", "Restaurants"]'),
      (21, 43, 'TESLA SUBSCRIPTION US', 107.54, '["Bills and Utilities"]'),
      (22, 44, 'TCB*MTA METER MTA MCK', 1.70, '["Bills and Utilities"]'),
      (22, 45, 'TST*TAQUERIA LOS MAYAS S', 16.30, '["Food and Drink", "Restaurants"]'),
      (23, 46, 'Amazon.com*E86U448F3', 10.98, '["Shops", "General Merchandise"]'),
      (23, 47, 'Amazon.com*X34N26W53', 108.58, '["Shops", "General Merchandise"]'),
      (24, 48, 'ETOLLAVIS U389742636', 24.90, '["Travel"]'),
      (24, 49, 'TST*AS QUOTED', 22.53, '["Food and Drink", "Restaurants"]'),
      (25, 50, 'COOKUNITY INC', 90.03, '["Food and Drink", "Groceries"]'),
      (25, 51, 'DD *DOORDASH GAICHICKE', 27.26, '["Food and Drink", "Restaurants"]'),
      (26, 52, 'ODYSSEY CHIROPRACTIC', 125.00, '["Health and Wellness"]'),
      (26, 53, 'SPORTS BASEMENT PRESIDIO', 19.54, '["Shops", "General Merchandise"]'),
      (27, 54, 'FACEBK *GPNKWXYBF2', 1.89, '["Service", "Professional Services"]'),
      (27, 55, 'SAFEWAY #1711', 35.16, '["Food and Drink", "Groceries"]'),
      (28, 56, 'SQ *REVEILLE COFFEE CO.', 4.46, '["Food and Drink", "Restaurants"]'),
      (28, 57, 'StickerApp', 34.76, '["Shops", "General Merchandise"]'),
      (29, 58, 'FREDERICKSEN HARDWARE', 6.52, '["Home", "Supplies"]'),
      (29, 59, 'HORSESHOE TAVERN', 29.98, '["Food and Drink", "Restaurants"]'),
      (30, 60, 'TST* BRENDA''S MEAT &amp; THRE', 117.83, '["Food and Drink", "Restaurants"]'),
      (30, 61, 'TST* EARTHBAR - CHESTNUT', 13.47, '["Food and Drink", "Restaurants"]'),
      (31, 62, 'FACEBK *2P3JFY4CF2', 5.00, '["Service", "Professional Services"]'),
      (31, 63, 'Payment Thank You-Mobile', -1300.00, '["Transfer", "Credit Card"]'),
      (31, 64, 'TST*BOICHIK BAGELS - SF', 5.41, '["Food and Drink", "Restaurants"]'),
      (32, 65, 'ODYSSEY CHIROPRACTIC', 125.00, '["Health and Wellness"]'),
      (32, 66, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (33, 67, 'TRADER JOE S #100', 28.91, '["Food and Drink", "Groceries"]'),
      (33, 68, 'TST*PIXLCAT COFFEE', 7.60, '["Food and Drink", "Restaurants"]'),
      (34, 69, 'D26483444', 30.61, '["Service", "Personal"]'),
      (34, 70, 'SQ *ANDYTOWN COFFEE ROAST', 4.00, '["Food and Drink", "Restaurants"]'),
      (35, 71, 'SQ *CENTO', 5.50, '["Food and Drink", "Restaurants"]'),
      (35, 72, 'YMCA OF SAN FRANCISCO', 91.00, '["Health and Wellness"]'),
      (36, 73, 'SP POLYMAKER 3D PRIN', 45.38, '["Home", "Supplies"]'),
      (36, 74, 'SPO*BLUEBARN-STEINER', 22.34, '["Food and Drink", "Groceries"]'),
      (37, 75, 'SQ *LOCALE', 83.80, '["Food and Drink", "Groceries"]'),
      (37, 76, 'TST* HORSEFEATHER', 113.96, '["Food and Drink", "Restaurants"]'),
      (38, 77, 'FACEBK *Q6YPY2DCF2', 3.00, '["Service", "Professional Services"]'),
      (38, 78, 'NOAH''S BAGELS #2103', 4.48, '["Food and Drink", "Restaurants"]'),
      (39, 79, 'FACEBK *AMBX73DCF2', 2.95, '["Service", "Professional Services"]'),
      (39, 80, 'SQ *FILLMORE', 5.43, '["Food and Drink", "Restaurants"]'),
      (40, 81, 'AMAZON MKTPL*RB3RA1SS3', 19.54, '["Shops", "General Merchandise"]'),
      (40, 82, 'FACEBK *FWLFA3DCF2', 3.33, '["Service", "Professional Services"]'),
      (41, 83, 'FACEBK *8V8QEZ4CF2', 2.64, '["Service", "Professional Services"]'),
      (41, 84, 'TRIBE PLATFORM INC.', 25.00, '["Shops", "General Merchandise"]'),
      (42, 85, 'DD *DOORDASH PACIFICCA', 38.02, '["Food and Drink", "Restaurants"]'),
      (42, 86, 'TAQUERIA CANCUN 3', 16.57, '["Food and Drink", "Restaurants"]'),
      (43, 87, 'TESLA SUPERCHARGER US', 16.88, '["Travel", "Auto and Gas"]'),
      (44, 88, 'DD *DOORDASH SOUVLA', 28.34, '["Food and Drink", "Restaurants"]'),
      (44, 89, 'TARGET        00032409', 13.34, '["Shops", "General Merchandise"]'),
      (45, 90, 'MIXT FILLMORE', 18.96, '["Food and Drink", "Restaurants"]'),
      (45, 91, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (46, 92, 'DD *DOORDASH SQUAREPIE', 25.23, '["Food and Drink", "Restaurants"]'),
      (47, 93, 'DD *DOORDASH SAFEWAY', 28.20, '["Food and Drink", "Restaurants"]'),
      (47, 94, 'SQ *REVEILLE COFFEE CO.', 4.46, '["Food and Drink", "Restaurants"]'),
      (48, 95, 'FASTRAK CSC', 10.00, '["Travel"]'),
      (48, 96, 'SQ *LOCALE', 135.50, '["Food and Drink", "Groceries"]'),
      (49, 97, 'DOORDASH*09/18-2 ORDER', 55.18, '["Food and Drink", "Restaurants"]'),
      (49, 98, 'FASTRAK CSC', 10.00, '["Travel"]'),
      (49, 99, 'Payment Thank You-Mobile', -900.00, '["Transfer", "Credit Card"]'),
      (50, 100, 'GOOGLE *YouTube', 13.99, '["Bills and Utilities"]'),
      (50, 101, 'SQ *HAYES VALLEY', 12.49, '["Food and Drink", "Restaurants"]'),
      (51, 102, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (51, 103, 'WAR ON THE ROCKS MEDIA', 15.00, '["Service", "Personal"]'),
      (52, 104, 'TESLA SUBSCRIPTION US', 107.54, '["Bills and Utilities"]'),
      (52, 105, 'TST*LITTLE ORIGINAL JOE', 94.60, '["Food and Drink", "Restaurants"]'),
      (53, 106, 'GOOGLE *Google One', 19.99, '["Entertainment"]'),
      (53, 107, 'MARINA SUPERMARKET', 42.85, '["Food and Drink", "Groceries"]'),
      (55, 108, 'SQ *LOCALE', 135.50, '["Food and Drink", "Groceries"]'),
      (56, 109, 'SQ *PALMETTO SUPERFOODS U', 9.50, '["Food and Drink", "Restaurants"]'),
      (56, 110, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (57, 111, 'AMAZON PRIME*NJ5HS0SD0', 2.99, '["Shops", "General Merchandise"]'),
      (57, 112, 'MADEWELL #3031', 112.80, '["Shops", "General Merchandise"]'),
      (58, 113, 'DD *DOORDASH BONITATAQ', 55.08, '["Food and Drink", "Restaurants"]'),
      (58, 114, 'SP BOBBY LONDON APPARE', 67.46, '["Shops", "General Merchandise"]'),
      (59, 115, 'CLOUDFLARE', 45.00, '["Shops", "General Merchandise"]'),
      (59, 116, 'SQ *REVEILLE COFFEE CO.', 18.98, '["Food and Drink", "Restaurants"]'),
      (60, 117, 'BLACK TIE TUXEDO &amp; FOR', 170.00, '["Shops", "General Merchandise"]'),
      (60, 118, 'FACEBK *S252C2HBF2', 3.01, '["Service", "Professional Services"]')
  ),
  prepared_transactions AS (
    SELECT
      base.start_date + raw.day_offset AS tx_date,
      raw.name,
      raw.amount,
      raw.category_text::jsonb AS plaid_category,
      row_number() OVER (
        PARTITION BY base.start_date + raw.day_offset
        ORDER BY raw.sequence
      ) AS daily_rank
    FROM base_dates base
    CROSS JOIN raw_transactions raw
  )
  INSERT INTO transactions (
    transaction_id,
    account_id,
    item_id,
    user_id,
    date,
    name,
    amount,
    pending,
    plaid_category,
    account_name,
    institution_name
  )
  SELECT
    format('demo_tx_%s_%s', to_char(tx_date, 'YYYYMMDD'), lpad(daily_rank::text, 2, '0')),
    credit_account_id,
    credit_item_id,
    seed_user_id,
    tx_date,
    name,
    amount,
    false,
    plaid_category,
    'Chase Sapphire Preferred',
    'Chase'
  FROM prepared_transactions
  ORDER BY tx_date, daily_rank;

  -- Liabilities
  INSERT INTO liabilities_credit (
    user_id,
    account_id,
    aprs,
    is_overdue,
    last_payment_amount,
    last_payment_date,
    last_statement_issue_date,
    last_statement_balance,
    minimum_payment_amount,
    next_payment_due_date,
    last_synced_at
  ) VALUES (
    seed_user_id,
    credit_account_id,
    '[{"apr_percentage":20.99,"apr_type":"purchase_apr","balance_subject_to_apr":2150.43,"interest_charge_amount":36.45}]'::jsonb,
    false,
    850.00,
    DATE '2025-01-12',
    DATE '2024-12-20',
    2560.14,
    86.00,
    DATE '2025-01-20',
    now() - INTERVAL '6 hours'
  );

  INSERT INTO liabilities_mortgage (
    user_id,
    account_id,
    account_number,
    loan_term,
    loan_type_description,
    origination_date,
    origination_principal_amount,
    maturity_date,
    interest_rate_percentage,
    interest_rate_type,
    property_address,
    next_payment_due_date,
    next_monthly_payment,
    last_payment_date,
    last_payment_amount,
    current_late_fee,
    past_due_amount,
    escrow_balance,
    has_pmi,
    has_prepayment_penalty,
    ytd_interest_paid,
    ytd_principal_paid,
    last_synced_at
  ) VALUES (
    seed_user_id,
    mortgage_account_id,
    '****4321',
    '30 year fixed',
    'Conventional fixed',
    DATE '2019-06-01',
    520000,
    DATE '2049-06-01',
    3.25,
    'fixed',
    '{"street":"4107 Oak Terrace","city":"Portland","region":"OR","postal_code":"97205","country":"US"}'::jsonb,
    DATE '2025-02-01',
    2687.55,
    DATE '2025-01-01',
    2687.55,
    0,
    0,
    4200.33,
    true,
    false,
    12450.27,
    8150.10,
    now() - INTERVAL '2 days'
  );

  -- Investment holdings
  INSERT INTO investment_holdings (
    user_id,
    account_id,
    security_id,
    quantity,
    institution_price,
    institution_price_as_of,
    institution_value,
    cost_basis,
    ticker_symbol,
    security_name,
    security_type,
    security_subtype,
    close_price,
    close_price_as_of,
    iso_currency_code,
    last_synced_at
  ) VALUES
    (
      seed_user_id,
      invest_account_id,
      'sec_demo_aapl',
      120.5,
      198.12,
      DATE '2025-01-10',
      23884.06,
      16250.00,
      'AAPL',
      'Apple Inc.',
      'equity',
      'common stock',
      198.12,
      DATE '2025-01-10',
      'USD',
      now() - INTERVAL '1 day'
    ),
    (
      seed_user_id,
      invest_account_id,
      'sec_demo_vti',
      80.0,
      259.43,
      DATE '2025-01-10',
      20754.40,
      18500.00,
      'VTI',
      'Vanguard Total Stock Market ETF',
      'etf',
      'index fund',
      259.43,
      DATE '2025-01-10',
      'USD',
      now() - INTERVAL '1 day'
    ),
    (
      seed_user_id,
      invest_account_id,
      'sec_demo_bnd',
      95.0,
      73.00,
      DATE '2025-01-10',
      6935.00,
      7200.00,
      'BND',
      'Vanguard Total Bond Market ETF',
      'etf',
      'bond fund',
      73.00,
      DATE '2025-01-10',
      'USD',
      now() - INTERVAL '1 day'
    );

  -- Net worth snapshots
  INSERT INTO net_worth_snapshots (
    user_id,
    snapshot_date,
    net_worth_amount,
    assets_total,
    liabilities_total
  ) VALUES
    (seed_user_id, DATE '2024-12-08', 132000.00, 512000.00, 380000.00),
    (seed_user_id, DATE '2024-12-15', 133250.00, 513500.00, 380250.00),
    (seed_user_id, DATE '2024-12-22', 134100.00, 515000.00, 380900.00),
    (seed_user_id, DATE '2024-12-29', 134750.00, 516250.00, 381500.00),
    (seed_user_id, DATE '2025-01-05', 135980.00, 518200.00, 382220.00),
    (seed_user_id, DATE '2025-01-12', 136450.00, 519000.00, 382550.00);

  RAISE NOTICE 'Seed complete for user %', seed_user_id;
END;
$seed$;

COMMIT;
