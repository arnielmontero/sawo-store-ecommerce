import { OrderStatus, PaymentMethod, AdminRole, StockAdjustmentReason, ReturnRequestStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { hashPassword } from "./password";

async function seedAdmins() {
  const adminPasswordHash = await hashPassword("admin123");
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: adminPasswordHash, name: "Admin", role: AdminRole.ADMIN },
  });

  const staffPasswordHash = await hashPassword("staff123");
  await prisma.adminUser.upsert({
    where: { username: "staff" },
    update: {},
    create: {
      username: "staff",
      passwordHash: staffPasswordHash,
      name: "Fulfillment Staff",
      role: AdminRole.FULFILLMENT_STAFF,
    },
  });
}

const CUSTOMER_COUNT = 12;
// Extra customers beyond the CUSTOMER_COUNT named ones above, used only by
// the bulk order batch below — kept as a separate range (starting after the
// named customers) so none of the hand-crafted orders' hardcoded
// customers[N] indexes shift.
const BULK_CUSTOMER_COUNT = 168;

async function seedCustomers() {
  const customerPasswordHash = await hashPassword("customer123");
  return Promise.all(
    Array.from({ length: CUSTOMER_COUNT }, (_, i) =>
      prisma.user.upsert({
        where: { email: `customer${i + 1}@example.com` },
        update: {},
        create: { email: `customer${i + 1}@example.com`, passwordHash: customerPasswordHash },
      })
    )
  );
}

async function seedBulkCustomers() {
  const customerPasswordHash = await hashPassword("customer123");
  return Promise.all(
    Array.from({ length: BULK_CUSTOMER_COUNT }, (_, i) => {
      const n = CUSTOMER_COUNT + i + 1;
      return prisma.user.upsert({
        where: { email: `customer${n}@example.com` },
        update: {},
        create: { email: `customer${n}@example.com`, passwordHash: customerPasswordHash },
      });
    })
  );
}

interface VariantSeed {
  sku: string;
  priceCents: number;
  attributes: Record<string, string>;
  stockQuantity: number;
}

// Multiplies every VariantSeed.stockQuantity below at seed time — see the
// comment where it's applied in seedCatalog for why.
const STOCK_MULTIPLIER = 6;

interface ProductSeed {
  title: string;
  slug: string;
  description: string;
  basePriceCents: number;
  compareAtPriceCents?: number;
  categorySlug: string;
  tags?: string[];
  variants: VariantSeed[];
}

// A sauna equipment retailer's actual catalog shape — heaters, stones,
// control panels, benches/backrests, doors/glass, and lighting/accessories,
// matching how SAWO's real product line is organized.
const CATEGORIES = [
  { name: "Heaters", slug: "heaters" },
  { name: "Sauna Stones", slug: "sauna-stones" },
  { name: "Control Panels", slug: "control-panels" },
  { name: "Benches & Backrests", slug: "benches-backrests" },
  { name: "Doors & Glass", slug: "doors-glass" },
  { name: "Lighting & Accessories", slug: "lighting-accessories" },
  // Deliberately has no products in PRODUCTS below — gives the Categories
  // panel (Catalog -> "Categories") a ready example of a deletable category
  // to test against, alongside the others which are all correctly
  // delete-blocked by having products assigned.
  { name: "Replacement Parts", slug: "replacement-parts" },
];

const PRODUCTS: ProductSeed[] = [
  {
    title: "Nordic Electric Sauna Heater",
    slug: "nordic-electric-sauna-heater",
    description: "Wall-mounted electric heater with built-in stone compartment, sized for home sauna rooms.",
    basePriceCents: 64900,
    categorySlug: "heaters",
    tags: ["bestseller", "electric"],
    variants: [
      { sku: "HTR-NORD-6KW", priceCents: 64900, attributes: { power: "6kW", roomSize: "70-130 ft³" }, stockQuantity: 22 },
      { sku: "HTR-NORD-8KW", priceCents: 71900, attributes: { power: "8kW", roomSize: "130-210 ft³" }, stockQuantity: 18 },
      { sku: "HTR-NORD-9KW", priceCents: 78900, attributes: { power: "9kW", roomSize: "180-280 ft³" }, stockQuantity: 12 },
    ],
  },
  {
    title: "Innova Digital Sauna Heater",
    slug: "innova-digital-sauna-heater",
    description: "Premium heater with integrated digital control and steam-generation option for combination saunas.",
    basePriceCents: 94900,
    compareAtPriceCents: 109900,
    categorySlug: "heaters",
    tags: ["new", "digital"],
    variants: [
      { sku: "HTR-INV-8KW", priceCents: 94900, attributes: { power: "8kW", roomSize: "130-210 ft³" }, stockQuantity: 10 },
      { sku: "HTR-INV-10KW", priceCents: 104900, attributes: { power: "10kW", roomSize: "210-310 ft³" }, stockQuantity: 7 },
    ],
  },
  {
    title: "Barrel Sauna Wood Heater",
    slug: "barrel-sauna-wood-heater",
    description: "Cast-iron, wood-burning heater built for outdoor barrel and cabin saunas.",
    basePriceCents: 82900,
    categorySlug: "heaters",
    tags: ["outdoor", "wood-burning"],
    variants: [
      { sku: "HTR-WOOD-16", priceCents: 82900, attributes: { power: "16kW equiv", material: "Cast Iron" }, stockQuantity: 9 },
      { sku: "HTR-WOOD-20", priceCents: 92900, attributes: { power: "20kW equiv", material: "Cast Iron" }, stockQuantity: 5 },
    ],
  },
  {
    title: "Finnish Peridotite Sauna Stones",
    slug: "finnish-peridotite-sauna-stones",
    description: "Hand-selected peridotite stones from Finland — high heat capacity, low crumble rate.",
    basePriceCents: 4900,
    categorySlug: "sauna-stones",
    tags: ["bestseller"],
    variants: [
      { sku: "STN-PERI-22LB", priceCents: 4900, attributes: { weight: "22 lb", type: "Peridotite" }, stockQuantity: 90 },
      { sku: "STN-PERI-44LB", priceCents: 8900, attributes: { weight: "44 lb", type: "Peridotite" }, stockQuantity: 55 },
    ],
  },
  {
    title: "Olivine Diabase Sauna Stones",
    slug: "olivine-diabase-sauna-stones",
    description: "Dense volcanic stones that hold heat longer for a smoother steam (löyly).",
    basePriceCents: 5900,
    categorySlug: "sauna-stones",
    variants: [
      { sku: "STN-OLIV-22LB", priceCents: 5900, attributes: { weight: "22 lb", type: "Olivine Diabase" }, stockQuantity: 40 },
      { sku: "STN-OLIV-44LB", priceCents: 10900, attributes: { weight: "44 lb", type: "Olivine Diabase" }, stockQuantity: 26 },
    ],
  },
  {
    title: "Innova Touch Control Panel",
    slug: "innova-touch-control-panel",
    description: "Touchscreen controller for temperature, humidity, and lighting — pairs with Innova heaters.",
    basePriceCents: 38900,
    categorySlug: "control-panels",
    tags: ["digital", "new"],
    variants: [
      { sku: "CTL-TOUCH-BLK", priceCents: 38900, attributes: { finish: "Black", interface: "Touchscreen" }, stockQuantity: 20 },
      { sku: "CTL-TOUCH-WHT", priceCents: 38900, attributes: { finish: "White", interface: "Touchscreen" }, stockQuantity: 14 },
    ],
  },
  {
    title: "Classic Analog Control Panel",
    slug: "classic-analog-control-panel",
    description: "Simple dial-based timer and thermostat control, compatible with most residential heaters.",
    basePriceCents: 14900,
    categorySlug: "control-panels",
    variants: [
      { sku: "CTL-ANLG-STD", priceCents: 14900, attributes: { finish: "Brushed Steel", interface: "Analog" }, stockQuantity: 33 },
    ],
  },
  {
    title: "Abachi Wood Sauna Bench Set",
    slug: "abachi-wood-sauna-bench-set",
    description: "Two-tier bench set in lightweight, low-resin Abachi wood — stays cool to the touch.",
    basePriceCents: 54900,
    categorySlug: "benches-backrests",
    tags: ["bestseller"],
    variants: [
      { sku: "BNCH-ABACHI-5FT", priceCents: 54900, attributes: { length: "5 ft", wood: "Abachi" }, stockQuantity: 15 },
      { sku: "BNCH-ABACHI-6FT", priceCents: 61900, attributes: { length: "6 ft", wood: "Abachi" }, stockQuantity: 11 },
      { sku: "BNCH-ABACHI-7FT", priceCents: 68900, attributes: { length: "7 ft", wood: "Abachi" }, stockQuantity: 6 },
    ],
  },
  {
    title: "Cedar Contoured Backrest",
    slug: "cedar-contoured-backrest",
    description: "Ergonomic western red cedar backrest, naturally rot- and insect-resistant.",
    basePriceCents: 18900,
    categorySlug: "benches-backrests",
    variants: [
      { sku: "BCK-CEDAR-3FT", priceCents: 18900, attributes: { length: "3 ft", wood: "Cedar" }, stockQuantity: 24 },
      { sku: "BCK-CEDAR-4FT", priceCents: 22900, attributes: { length: "4 ft", wood: "Cedar" }, stockQuantity: 17 },
    ],
  },
  {
    title: "Frameless Glass Sauna Door",
    slug: "frameless-glass-sauna-door",
    description: "8mm tempered clear glass door with a bronze or clear tint option, frameless hinge kit included.",
    basePriceCents: 44900,
    compareAtPriceCents: 52900,
    categorySlug: "doors-glass",
    tags: ["popular"],
    variants: [
      { sku: "DOOR-GLS-CLR", priceCents: 44900, attributes: { tint: "Clear", thickness: "8mm" }, stockQuantity: 13 },
      { sku: "DOOR-GLS-BRZ", priceCents: 46900, attributes: { tint: "Bronze", thickness: "8mm" }, stockQuantity: 9 },
    ],
  },
  {
    title: "Cedar-Framed Glass Door",
    slug: "cedar-framed-glass-door",
    description: "Tempered glass insert set in a solid cedar frame for a more traditional look.",
    basePriceCents: 39900,
    categorySlug: "doors-glass",
    variants: [
      { sku: "DOOR-CDR-CLR", priceCents: 39900, attributes: { tint: "Clear", frame: "Cedar" }, stockQuantity: 8 },
    ],
  },
  {
    title: "Fiber-Optic Star Ceiling Kit",
    slug: "fiber-optic-star-ceiling-kit",
    description: "150-strand fiber-optic lighting kit with color-changing LED driver for a starlight ceiling effect.",
    basePriceCents: 32900,
    categorySlug: "lighting-accessories",
    tags: ["new"],
    variants: [
      { sku: "LGT-FIBER-150", priceCents: 32900, attributes: { strands: "150", driver: "RGB LED" }, stockQuantity: 19 },
    ],
  },
  {
    title: "Sauna Bucket & Ladle Set",
    slug: "sauna-bucket-ladle-set",
    description: "Solid cedar bucket and matching ladle for pouring water over the stones.",
    basePriceCents: 6900,
    categorySlug: "lighting-accessories",
    tags: ["everyday"],
    variants: [
      { sku: "ACC-BUCKET-CDR", priceCents: 6900, attributes: { wood: "Cedar" }, stockQuantity: 60 },
    ],
  },
  {
    title: "Sauna Thermometer & Hygrometer",
    slug: "sauna-thermometer-hygrometer",
    description: "Combined analog thermometer and hygrometer on a cedar backing, rated for high-heat rooms.",
    basePriceCents: 3900,
    categorySlug: "lighting-accessories",
    variants: [
      { sku: "ACC-THERM-CDR", priceCents: 3900, attributes: { wood: "Cedar" }, stockQuantity: 75 },
    ],
  },
];

async function seedCatalog() {
  const categoriesBySlug = new Map<string, number>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    categoriesBySlug.set(category.slug, created.id);
  }

  const variantsBySku = new Map<string, number>();
  for (const productSeed of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: productSeed.slug },
      update: {},
      create: {
        title: productSeed.title,
        slug: productSeed.slug,
        description: productSeed.description,
        basePriceCents: productSeed.basePriceCents,
        compareAtPriceCents: productSeed.compareAtPriceCents,
        categoryId: categoriesBySlug.get(productSeed.categorySlug),
      },
    });

    if (productSeed.tags && productSeed.tags.length > 0) {
      for (const tagName of productSeed.tags) {
        const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const tag = await prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name: tagName, slug },
        });
        await prisma.productTag.upsert({
          where: { productId_tagId: { productId: product.id, tagId: tag.id } },
          update: {},
          create: { productId: product.id, tagId: tag.id },
        });
      }
    }

    for (const variantSeed of productSeed.variants) {
      // Base figures above read as a believable "starting" stock count for a
      // specialty retailer; multiplied up here because the bulk order batch
      // (see seedBulkOrders) simulates a full year of real sales against
      // this same stock, and the base figures alone would draw everything
      // down to nearly zero.
      const startingStock = variantSeed.stockQuantity * STOCK_MULTIPLIER;
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantSeed.sku },
        update: {},
        create: {
          sku: variantSeed.sku,
          priceCents: variantSeed.priceCents,
          attributes: variantSeed.attributes,
          productId: product.id,
          inventory: { create: { stockQuantity: startingStock } },
        },
      });
      variantsBySku.set(variantSeed.sku, variant.id);
    }
  }

  return variantsBySku;
}

interface OrderSeed {
  reference: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  isNewClient: boolean;
  customerIndex: number;
  lines: Array<{ sku: string; quantity: number }>;
  // Fake Stripe PaymentIntent id — orders that reached the payment step get
  // one, so GET /api/v1/payments (which filters on this field) has data to
  // show. Not a real Stripe object; fine for local seed data.
  stripePaymentIntentId?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  // Days before "now" this order was placed — spreads orders across a
  // realistic date range instead of everything landing on the seed run's
  // exact timestamp, so date columns and the statistics panel show a trend.
  daysAgo: number;
}

const ADDRESSES = [
  "221 Baker Street, Springfield, IL 62701",
  "48 Ocean Drive, Miami, FL 33139",
  "1600 Pine Ave, Seattle, WA 98101",
  "77 Elm Court, Austin, TX 78701",
  "12 Maple Lane, Portland, OR 97201",
];

const ORDERS: OrderSeed[] = [
  {
    reference: "SAW-HTR-0091",
    status: OrderStatus.SHIPPED,
    paymentMethod: PaymentMethod.PAY_WITH_CHECK,
    isNewClient: false,
    customerIndex: 0,
    lines: [
      { sku: "HTR-NORD-8KW", quantity: 1 },
      { sku: "STN-PERI-44LB", quantity: 2 },
    ],
    stripePaymentIntentId: "pi_seed_001",
    shippingAddress: ADDRESSES[0],
    trackingNumber: "1Z999AA10123456784",
    daysAgo: 2,
  },
  {
    reference: "SAW-STN-0044",
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.PAYPAL,
    isNewClient: true,
    customerIndex: 1,
    lines: [{ sku: "STN-OLIV-22LB", quantity: 1 }],
    daysAgo: 0,
  },
  {
    reference: "SAW-BNCH-0027",
    status: OrderStatus.PAID,
    paymentMethod: PaymentMethod.BANK,
    isNewClient: false,
    customerIndex: 2,
    lines: [{ sku: "BNCH-ABACHI-6FT", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_002",
    shippingAddress: ADDRESSES[1],
    daysAgo: 1,
  },
  {
    reference: "SAW-DOOR-0013",
    status: OrderStatus.SHIPPED,
    paymentMethod: PaymentMethod.PAY_WITH_CHECK,
    isNewClient: true,
    customerIndex: 3,
    lines: [
      { sku: "DOOR-GLS-CLR", quantity: 1 },
      { sku: "ACC-THERM-CDR", quantity: 1 },
    ],
    stripePaymentIntentId: "pi_seed_003",
    shippingAddress: ADDRESSES[2],
    trackingNumber: "1Z999AA10123456785",
    daysAgo: 4,
  },
  {
    reference: "SAW-HTR-0092",
    status: OrderStatus.SHIPPED,
    paymentMethod: PaymentMethod.PAY_WITH_CHECK,
    isNewClient: true,
    customerIndex: 4,
    lines: [{ sku: "HTR-WOOD-16", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_004",
    shippingAddress: ADDRESSES[3],
    trackingNumber: "1Z999AA10123456786",
    daysAgo: 6,
  },
  {
    reference: "SAW-ACC-0058",
    status: OrderStatus.PAID,
    paymentMethod: PaymentMethod.BANK,
    isNewClient: false,
    customerIndex: 5,
    lines: [{ sku: "ACC-BUCKET-CDR", quantity: 3 }],
    stripePaymentIntentId: "pi_seed_005",
    shippingAddress: ADDRESSES[4],
    daysAgo: 3,
  },
  {
    reference: "SAW-CTL-0019",
    status: OrderStatus.DELIVERED,
    paymentMethod: PaymentMethod.PAY_WITH_CHECK,
    isNewClient: true,
    customerIndex: 6,
    lines: [{ sku: "CTL-TOUCH-BLK", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_006",
    shippingAddress: ADDRESSES[0],
    trackingNumber: "1Z999AA10123456787",
    daysAgo: 12,
  },
  {
    reference: "SAW-BCK-0033",
    status: OrderStatus.CANCELLED,
    paymentMethod: PaymentMethod.CARD,
    isNewClient: false,
    customerIndex: 0,
    lines: [{ sku: "BCK-CEDAR-4FT", quantity: 1 }],
    // No PaymentIntent — this one was cancelled before payment was attempted.
    daysAgo: 9,
  },
  {
    reference: "SAW-HTR-0093",
    status: OrderStatus.REFUNDED,
    paymentMethod: PaymentMethod.CARD,
    isNewClient: false,
    customerIndex: 7,
    lines: [{ sku: "HTR-INV-8KW", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_007",
    shippingAddress: ADDRESSES[1],
    daysAgo: 15,
  },
  {
    reference: "SAW-BNCH-0028",
    status: OrderStatus.RETURNED,
    paymentMethod: PaymentMethod.PAYPAL,
    isNewClient: false,
    customerIndex: 8,
    lines: [
      { sku: "BNCH-ABACHI-5FT", quantity: 1 },
      { sku: "BCK-CEDAR-3FT", quantity: 2 },
    ],
    stripePaymentIntentId: "pi_seed_008",
    shippingAddress: ADDRESSES[2],
    trackingNumber: "1Z999AA10123456788",
    daysAgo: 20,
  },
  {
    reference: "SAW-STN-0045",
    status: OrderStatus.DELIVERED,
    paymentMethod: PaymentMethod.BANK,
    isNewClient: true,
    customerIndex: 9,
    lines: [{ sku: "STN-PERI-22LB", quantity: 3 }],
    stripePaymentIntentId: "pi_seed_009",
    shippingAddress: ADDRESSES[3],
    trackingNumber: "1Z999AA10123456789",
    daysAgo: 25,
  },
  {
    reference: "SAW-LGT-0007",
    status: OrderStatus.PENDING,
    paymentMethod: PaymentMethod.CARD,
    isNewClient: true,
    customerIndex: 10,
    lines: [{ sku: "LGT-FIBER-150", quantity: 1 }],
    daysAgo: 0,
  },
  {
    reference: "SAW-HTR-0094",
    status: OrderStatus.PAID,
    paymentMethod: PaymentMethod.PAYPAL,
    isNewClient: false,
    customerIndex: 0,
    lines: [
      { sku: "HTR-NORD-6KW", quantity: 1 },
      { sku: "CTL-ANLG-STD", quantity: 1 },
    ],
    stripePaymentIntentId: "pi_seed_010",
    shippingAddress: ADDRESSES[4],
    daysAgo: 1,
  },
  {
    reference: "SAW-DOOR-0014",
    status: OrderStatus.DELIVERED,
    paymentMethod: PaymentMethod.PAY_WITH_CHECK,
    isNewClient: false,
    customerIndex: 11,
    lines: [{ sku: "DOOR-CDR-CLR", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_011",
    shippingAddress: ADDRESSES[0],
    trackingNumber: "1Z999AA10123456790",
    daysAgo: 30,
  },
  {
    reference: "SAW-BNCH-0029",
    status: OrderStatus.SHIPPED,
    paymentMethod: PaymentMethod.BANK,
    isNewClient: false,
    customerIndex: 2,
    lines: [{ sku: "BNCH-ABACHI-7FT", quantity: 1 }],
    stripePaymentIntentId: "pi_seed_012",
    shippingAddress: ADDRESSES[1],
    trackingNumber: "1Z999AA10123456791",
    daysAgo: 5,
  },
];

async function seedOrders(customers: { id: number }[], variantsBySku: Map<string, number>) {
  const existingCount = await prisma.order.count();
  if (existingCount > 0) return;

  const priceBySku = new Map(
    PRODUCTS.flatMap((product) => product.variants.map((v) => [v.sku, v.priceCents] as const))
  );

  for (const orderSeed of ORDERS) {
    const items = orderSeed.lines.map((line) => {
      const unitPriceCents = priceBySku.get(line.sku);
      const variantId = variantsBySku.get(line.sku);
      if (!unitPriceCents || !variantId) throw new Error(`Unknown SKU in seed data: ${line.sku}`);
      return { variantId, quantity: line.quantity, unitPriceCents };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const createdAt = new Date(Date.now() - orderSeed.daysAgo * 24 * 60 * 60 * 1000);

    await prisma.order.create({
      data: {
        reference: orderSeed.reference,
        status: orderSeed.status,
        paymentMethod: orderSeed.paymentMethod,
        isNewClient: orderSeed.isNewClient,
        userId: customers[orderSeed.customerIndex].id,
        subtotalCents,
        totalCents: subtotalCents,
        stripePaymentIntentId: orderSeed.stripePaymentIntentId,
        paymentAttemptCount: orderSeed.stripePaymentIntentId ? 1 : 0,
        shippingAddress: orderSeed.shippingAddress,
        trackingNumber: orderSeed.trackingNumber,
        createdAt,
        items: { create: items },
        // Seed orders are created directly at their final status rather
        // than progressing through checkout()/updateOrderStatus() like a
        // real order would, so there's no real per-transition history to
        // record — this single entry (dated at createdAt, the closest
        // honest approximation) just keeps the Timeline UI from showing
        // "No status history recorded" for every demo order.
        statusHistory: { create: { status: orderSeed.status, changedAt: createdAt } },
      },
    });
  }
}

// A richer, hand-built order demonstrating the partial-refunds feature end
// to end — real RefundRecord/RefundRecordItem rows, a proper multi-stage
// statusHistory, and a staff note explaining why, so the feature has actual
// data to show (Held Orders list, order timeline, refund audit trail)
// without needing a live Stripe key, which isn't available in this
// environment right now. Kept separate from the flat ORDERS/OrderSeed list
// above since it needs richer shape (refund + note data) than that table
// carries.
async function seedPartialRefundExample(customers: { id: number }[], variantsBySku: Map<string, number>) {
  const existing = await prisma.order.findFirst({ where: { reference: "SAW-HTR-0095" } });
  if (existing) return;

  const priceBySku = new Map(
    PRODUCTS.flatMap((product) => product.variants.map((v) => [v.sku, v.priceCents] as const))
  );

  const heaterSku = "HTR-NORD-9KW";
  const stoneSku = "STN-OLIV-44LB";
  const heaterPriceCents = priceBySku.get(heaterSku)!;
  const stonePriceCents = priceBySku.get(stoneSku)!;
  const stoneQuantity = 2;
  const subtotalCents = heaterPriceCents + stonePriceCents * stoneQuantity;

  const placedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const paidAt = new Date(placedAt.getTime() + 20 * 60 * 1000);
  const refundedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // One bag of stones arrived cracked — customer keeps the heater and the
  // other bag, gets refunded for just the damaged unit, and that one unit
  // is restocked. The order stays PARTIALLY_REFUNDED (not fully resolved)
  // since the heater itself was never returned.
  const refundAmountCents = stonePriceCents;

  const order = await prisma.order.create({
    data: {
      reference: "SAW-HTR-0095",
      status: OrderStatus.PARTIALLY_REFUNDED,
      paymentMethod: PaymentMethod.CARD,
      isNewClient: false,
      userId: customers[9].id,
      subtotalCents,
      totalCents: subtotalCents,
      refundedCents: refundAmountCents,
      stripePaymentIntentId: "pi_seed_013",
      paymentAttemptCount: 1,
      shippingAddress: ADDRESSES[3],
      createdAt: placedAt,
      items: {
        create: [
          { variantId: variantsBySku.get(heaterSku)!, quantity: 1, unitPriceCents: heaterPriceCents },
          { variantId: variantsBySku.get(stoneSku)!, quantity: stoneQuantity, unitPriceCents: stonePriceCents },
        ],
      },
      statusHistory: {
        create: [
          { status: OrderStatus.PENDING, changedAt: placedAt },
          { status: OrderStatus.PAID, changedAt: paidAt },
          { status: OrderStatus.PARTIALLY_REFUNDED, changedAt: refundedAt },
        ],
      },
      notes: {
        create: {
          body: "Customer reported one bag of Olivine Diabase stones arrived cracked. Refunded the single damaged unit and restocked it after inspection; heater and remaining stone bag were kept, no further action needed.",
          authorName: "Admin",
          createdAt: refundedAt,
        },
      },
    },
    include: { items: true },
  });

  const stoneItem = order.items.find((item) => item.variantId === variantsBySku.get(stoneSku))!;

  await prisma.refundRecord.create({
    data: {
      orderId: order.id,
      amountCents: refundAmountCents,
      stripeRefundId: "re_seed_001",
      createdAt: refundedAt,
      items: { create: { orderItemId: stoneItem.id, quantity: 1 } },
    },
  });
}

// Two more hand-built orders so the newer admin features (Held Orders,
// order notes, multi-refund audit trail) have more than a single example
// each to show. Kept separate from seedPartialRefundExample for the same
// reason that one is separate from the flat ORDERS table — richer shape
// than OrderSeed carries.
async function seedMoreOrderExamples(customers: { id: number }[], variantsBySku: Map<string, number>) {
  const existing = await prisma.order.findFirst({ where: { reference: "SAW-BNCH-0030" } });
  if (existing) return;

  const priceBySku = new Map(
    PRODUCTS.flatMap((product) => product.variants.map((v) => [v.sku, v.priceCents] as const))
  );

  // Order A: two sequential partial refunds on the same order — exercises
  // the cumulative-restock tracking (RefundRecordItem summed across every
  // prior RefundRecord) visibly in the UI, not just in code. Customer
  // returned one backrest as the wrong length, then later decided to
  // return one bench too, but kept the rest — order stays
  // PARTIALLY_REFUNDED since the second bench and one backrest are kept.
  {
    const benchSku = "BNCH-ABACHI-6FT";
    const backrestSku = "BCK-CEDAR-4FT";
    const benchPriceCents = priceBySku.get(benchSku)!;
    const backrestPriceCents = priceBySku.get(backrestSku)!;
    const benchQuantity = 2;
    const backrestQuantity = 2;
    const subtotalCents = benchPriceCents * benchQuantity + backrestPriceCents * backrestQuantity;

    const placedAt = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
    const paidAt = new Date(placedAt.getTime() + 15 * 60 * 1000);
    const firstRefundAt = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
    const secondRefundAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const firstRefundCents = backrestPriceCents;
    const secondRefundCents = benchPriceCents;

    const order = await prisma.order.create({
      data: {
        reference: "SAW-BNCH-0030",
        status: OrderStatus.PARTIALLY_REFUNDED,
        paymentMethod: PaymentMethod.CARD,
        isNewClient: false,
        userId: customers[3].id,
        subtotalCents,
        totalCents: subtotalCents,
        refundedCents: firstRefundCents + secondRefundCents,
        stripePaymentIntentId: "pi_seed_014",
        paymentAttemptCount: 1,
        shippingAddress: ADDRESSES[2],
        createdAt: placedAt,
        items: {
          create: [
            { variantId: variantsBySku.get(benchSku)!, quantity: benchQuantity, unitPriceCents: benchPriceCents },
            {
              variantId: variantsBySku.get(backrestSku)!,
              quantity: backrestQuantity,
              unitPriceCents: backrestPriceCents,
            },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, changedAt: placedAt },
            { status: OrderStatus.PAID, changedAt: paidAt },
            { status: OrderStatus.PARTIALLY_REFUNDED, changedAt: firstRefundAt },
            { status: OrderStatus.PARTIALLY_REFUNDED, changedAt: secondRefundAt },
          ],
        },
        notes: {
          create: [
            {
              body: "Customer ordered the 4ft backrest by mistake and wanted the 3ft — refunded and restocked one unit; they're keeping the second one as a spare.",
              authorName: "Fulfillment Staff",
              createdAt: firstRefundAt,
            },
            {
              body: "Follow-up call: customer also returning one of the two Abachi benches, room ended up smaller than planned. Refunded and restocked one bench unit.",
              authorName: "Admin",
              createdAt: secondRefundAt,
            },
          ],
        },
      },
      include: { items: true },
    });

    const benchItem = order.items.find((item) => item.variantId === variantsBySku.get(benchSku))!;
    const backrestItem = order.items.find((item) => item.variantId === variantsBySku.get(backrestSku))!;

    await prisma.refundRecord.create({
      data: {
        orderId: order.id,
        amountCents: firstRefundCents,
        stripeRefundId: "re_seed_002",
        createdAt: firstRefundAt,
        items: { create: { orderItemId: backrestItem.id, quantity: 1 } },
      },
    });
    await prisma.refundRecord.create({
      data: {
        orderId: order.id,
        amountCents: secondRefundCents,
        stripeRefundId: "re_seed_003",
        createdAt: secondRefundAt,
        items: { create: { orderItemId: benchItem.id, quantity: 1 } },
      },
    });
  }

  // Order B: two partial refunds that add up to the FULL order total —
  // exercises the path where refundOrder() computes newRefundedCents >=
  // totalCents and lands the order on REFUNDED (not PARTIALLY_REFUNDED)
  // even though it got there via the partial-refund flow. Customer
  // returned a broken control panel, then decided against the whole order
  // and returned the heater too.
  {
    const heaterSku = "HTR-INV-8KW";
    const panelSku = "CTL-TOUCH-WHT";
    const heaterPriceCents = priceBySku.get(heaterSku)!;
    const panelPriceCents = priceBySku.get(panelSku)!;
    const subtotalCents = heaterPriceCents + panelPriceCents;

    const placedAt = new Date(Date.now() - 22 * 24 * 60 * 60 * 1000);
    const paidAt = new Date(placedAt.getTime() + 10 * 60 * 1000);
    const firstRefundAt = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
    const secondRefundAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        reference: "SAW-HTR-0096",
        status: OrderStatus.REFUNDED,
        paymentMethod: PaymentMethod.CARD,
        isNewClient: true,
        userId: customers[6].id,
        subtotalCents,
        totalCents: subtotalCents,
        refundedCents: subtotalCents,
        stripePaymentIntentId: "pi_seed_015",
        paymentAttemptCount: 1,
        shippingAddress: ADDRESSES[4],
        createdAt: placedAt,
        items: {
          create: [
            { variantId: variantsBySku.get(heaterSku)!, quantity: 1, unitPriceCents: heaterPriceCents },
            { variantId: variantsBySku.get(panelSku)!, quantity: 1, unitPriceCents: panelPriceCents },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, changedAt: placedAt },
            { status: OrderStatus.PAID, changedAt: paidAt },
            { status: OrderStatus.PARTIALLY_REFUNDED, changedAt: firstRefundAt },
            { status: OrderStatus.REFUNDED, changedAt: secondRefundAt },
          ],
        },
        notes: {
          create: [
            {
              body: "Control panel arrived with a cracked touchscreen — refunded and restocked for inspection/repair.",
              authorName: "Fulfillment Staff",
              createdAt: firstRefundAt,
            },
            {
              body: "Customer decided to cancel the whole installation after the panel issue. Refunded the heater as well and restocked it; order fully resolved.",
              authorName: "Admin",
              createdAt: secondRefundAt,
            },
          ],
        },
      },
      include: { items: true },
    });

    const heaterItem = order.items.find((item) => item.variantId === variantsBySku.get(heaterSku))!;
    const panelItem = order.items.find((item) => item.variantId === variantsBySku.get(panelSku))!;

    await prisma.refundRecord.create({
      data: {
        orderId: order.id,
        amountCents: panelPriceCents,
        stripeRefundId: "re_seed_004",
        createdAt: firstRefundAt,
        items: { create: { orderItemId: panelItem.id, quantity: 1 } },
      },
    });
    await prisma.refundRecord.create({
      data: {
        orderId: order.id,
        amountCents: heaterPriceCents,
        stripeRefundId: "re_seed_005",
        createdAt: secondRefundAt,
        items: { create: { orderItemId: heaterItem.id, quantity: 1 } },
      },
    });
  }
}

// Three DELIVERED orders demonstrating every ReturnRequestStatus end to
// end — PENDING (sitting for review, nothing has moved yet), APPROVED
// (built by hand with a real RefundRecord, the same way
// seedPartialRefundExample fakes a completed Stripe refund, since a live
// Stripe key isn't available in this environment), and REJECTED (money and
// stock both untouched). Kept separate from seedMoreOrderExamples for the
// same reason that one is separate from the flat ORDERS table — this needs
// ReturnRequest/ReturnRequestItem rows that table doesn't carry.
async function seedReturnRequestExamples(customers: { id: number }[], variantsBySku: Map<string, number>) {
  const existing = await prisma.order.findFirst({ where: { reference: "SAW-RET-0001" } });
  if (existing) return;

  const priceBySku = new Map(
    PRODUCTS.flatMap((product) => product.variants.map((v) => [v.sku, v.priceCents] as const))
  );

  // Order 1: PENDING — customer says the control panel arrived defective,
  // staff logged it, nobody's reviewed it yet. Order stays DELIVERED; no
  // money or stock has moved.
  {
    const panelSku = "CTL-TOUCH-BLK";
    const panelPriceCents = priceBySku.get(panelSku)!;
    const subtotalCents = panelPriceCents;

    const placedAt = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    const paidAt = new Date(placedAt.getTime() + 12 * 60 * 1000);
    const shippedAt = new Date(placedAt.getTime() + 1 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(placedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const requestedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        reference: "SAW-RET-0001",
        status: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.CARD,
        isNewClient: true,
        userId: customers[1].id,
        subtotalCents,
        totalCents: subtotalCents,
        stripePaymentIntentId: "pi_seed_016",
        paymentAttemptCount: 1,
        shippingAddress: ADDRESSES[0],
        createdAt: placedAt,
        items: { create: [{ variantId: variantsBySku.get(panelSku)!, quantity: 1, unitPriceCents: panelPriceCents }] },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, changedAt: placedAt },
            { status: OrderStatus.PAID, changedAt: paidAt },
            { status: OrderStatus.SHIPPED, changedAt: shippedAt },
            { status: OrderStatus.DELIVERED, changedAt: deliveredAt },
          ],
        },
      },
      include: { items: true },
    });

    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        reason: "Touch panel doesn't power on — customer confirmed outlet and breaker are fine.",
        loggedByName: "Fulfillment Staff",
        createdAt: requestedAt,
        items: { create: { orderItemId: order.items[0].id, quantity: 1 } },
      },
    });

    // Matches what notifyReturnRequestPending (notification.service.ts)
    // creates for a real request — seeded directly here (like the rest of
    // this file bypasses the service layer for historical backdating)
    // rather than through the service, but with the identical shape/
    // dedupeKey, so this PENDING example shows up in the inbox exactly the
    // way a real one would.
    await prisma.notification.create({
      data: {
        type: "RETURN_REQUEST_PENDING",
        dedupeKey: `return-request-${returnRequest.id}`,
        title: `Return requested — ${order.reference}`,
        body: returnRequest.reason,
        link: `/orders/${order.id}`,
        createdAt: requestedAt,
      },
    });
  }

  // Order 2: APPROVED — customer returned a bag of stones as the wrong
  // type, staff reviewed and approved it. Built by hand with a completed
  // RefundRecord/restock (same reasoning as seedPartialRefundExample: no
  // live Stripe key here to actually process it), landing the order on
  // PARTIALLY_REFUNDED since only one of the two items is refunded.
  {
    const heaterSku = "HTR-NORD-8KW";
    const stoneSku = "STN-PERI-44LB";
    const heaterPriceCents = priceBySku.get(heaterSku)!;
    const stonePriceCents = priceBySku.get(stoneSku)!;
    const subtotalCents = heaterPriceCents + stonePriceCents;

    const placedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const paidAt = new Date(placedAt.getTime() + 8 * 60 * 1000);
    const shippedAt = new Date(placedAt.getTime() + 1 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(placedAt.getTime() + 4 * 24 * 60 * 60 * 1000);
    const requestedAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const resolvedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        reference: "SAW-RET-0002",
        status: OrderStatus.PARTIALLY_REFUNDED,
        paymentMethod: PaymentMethod.CARD,
        isNewClient: false,
        userId: customers[4].id,
        subtotalCents,
        totalCents: subtotalCents,
        refundedCents: stonePriceCents,
        stripePaymentIntentId: "pi_seed_017",
        paymentAttemptCount: 1,
        shippingAddress: ADDRESSES[3],
        createdAt: placedAt,
        items: {
          create: [
            { variantId: variantsBySku.get(heaterSku)!, quantity: 1, unitPriceCents: heaterPriceCents },
            { variantId: variantsBySku.get(stoneSku)!, quantity: 1, unitPriceCents: stonePriceCents },
          ],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, changedAt: placedAt },
            { status: OrderStatus.PAID, changedAt: paidAt },
            { status: OrderStatus.SHIPPED, changedAt: shippedAt },
            { status: OrderStatus.DELIVERED, changedAt: deliveredAt },
            { status: OrderStatus.PARTIALLY_REFUNDED, changedAt: resolvedAt },
          ],
        },
      },
      include: { items: true },
    });

    const stoneItem = order.items.find((item) => item.variantId === variantsBySku.get(stoneSku))!;

    const refundRecord = await prisma.refundRecord.create({
      data: {
        orderId: order.id,
        amountCents: stonePriceCents,
        stripeRefundId: "re_seed_006",
        createdAt: resolvedAt,
        items: { create: { orderItemId: stoneItem.id, quantity: 1 } },
      },
    });

    await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        status: ReturnRequestStatus.APPROVED,
        reason: "Customer ordered the wrong stone type (Peridotite instead of Olivine Diabase) — keeping the heater.",
        loggedByName: "Admin",
        createdAt: requestedAt,
        resolvedByName: "Admin",
        resolvedAt,
        reviewNote: "Confirmed unopened, approved full refund for the stones.",
        refundRecordId: refundRecord.id,
        items: { create: { orderItemId: stoneItem.id, quantity: 1 } },
      },
    });
  }

  // Order 3: REJECTED — customer asked to return a bucket set well past a
  // reasonable window with signs of use; staff rejected it. Order stays
  // DELIVERED, no money or stock moved.
  {
    const bucketSku = "ACC-BUCKET-CDR";
    const bucketPriceCents = priceBySku.get(bucketSku)!;
    const bucketQuantity = 2;
    const subtotalCents = bucketPriceCents * bucketQuantity;

    const placedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const paidAt = new Date(placedAt.getTime() + 5 * 60 * 1000);
    const shippedAt = new Date(placedAt.getTime() + 1 * 24 * 60 * 60 * 1000);
    const deliveredAt = new Date(placedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const requestedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const resolvedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        reference: "SAW-RET-0003",
        status: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.BANK,
        isNewClient: false,
        userId: customers[7].id,
        subtotalCents,
        totalCents: subtotalCents,
        stripePaymentIntentId: "pi_seed_018",
        paymentAttemptCount: 1,
        shippingAddress: ADDRESSES[2],
        createdAt: placedAt,
        items: {
          create: [{ variantId: variantsBySku.get(bucketSku)!, quantity: bucketQuantity, unitPriceCents: bucketPriceCents }],
        },
        statusHistory: {
          create: [
            { status: OrderStatus.PENDING, changedAt: placedAt },
            { status: OrderStatus.PAID, changedAt: paidAt },
            { status: OrderStatus.SHIPPED, changedAt: shippedAt },
            { status: OrderStatus.DELIVERED, changedAt: deliveredAt },
          ],
        },
      },
      include: { items: true },
    });

    await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        status: ReturnRequestStatus.REJECTED,
        reason: "Customer says the buckets are the wrong shade of cedar and wants a refund.",
        loggedByName: "Fulfillment Staff",
        createdAt: requestedAt,
        resolvedByName: "Admin",
        resolvedAt,
        reviewNote: "Delivered almost 2 months ago and shows signs of use in the photos provided — outside our return window, declined.",
        items: { create: { orderItemId: order.items[0].id, quantity: bucketQuantity } },
      },
    });
  }
}

// Fills in full profile detail (name/phone/address) for every one of the
// CUSTOMER_COUNT curated customers (the ones with hand-crafted named
// orders, indices 0-11) — demonstrates the Customer page's "full customer
// information" section fully populated rather than mostly blank. These get
// hand-picked, individually distinct profiles; the BULK_CUSTOMER_COUNT
// customers get algorithmically generated ones instead (see
// seedBulkCustomerProfiles below) since hand-writing 168 is impractical. A
// real store's contact info is filled in gradually by staff over time
// anyway — there's no storefront signup flow here at all (see checkout()).
async function seedCustomerProfileDetails(customers: { id: number }[]) {
  const profiles = [
    {
      index: 0,
      name: "Dana Reyes",
      phone: "+1 217-555-0142",
      addressLine1: "221 Baker Street",
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
      country: "United States",
    },
    {
      index: 1,
      name: "Marcus Tan",
      phone: "+1 305-555-0198",
      addressLine1: "48 Ocean Drive",
      addressLine2: "Unit 4B",
      city: "Miami",
      state: "FL",
      postalCode: "33139",
      country: "United States",
    },
    {
      index: 2,
      name: "Priya Nair",
      phone: "+1 206-555-0163",
      addressLine1: "1600 Pine Ave",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "United States",
    },
    {
      index: 3,
      name: "Owen Brooks",
      phone: "+1 512-555-0119",
      addressLine1: "77 Elm Court",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "United States",
    },
    {
      index: 4,
      name: "Ingrid Petersen",
      phone: "+1 503-555-0177",
      addressLine1: "12 Maple Lane",
      city: "Portland",
      state: "OR",
      postalCode: "97201",
      country: "United States",
    },
    {
      index: 5,
      name: "Felix Hartmann",
      phone: "+1 217-555-0184",
      addressLine1: "310 Baker Street",
      addressLine2: "Apt 2",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "United States",
    },
    {
      index: 6,
      name: "Greta Lindqvist",
      phone: "+1 305-555-0146",
      addressLine1: "9 Ocean Drive",
      city: "Miami",
      state: "FL",
      postalCode: "33139",
      country: "United States",
    },
    {
      index: 7,
      name: "Victor Nakamura",
      phone: "+1 206-555-0129",
      addressLine1: "2200 Pine Ave",
      addressLine2: "Suite 100",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "United States",
    },
    {
      index: 8,
      name: "Naomi Cole",
      phone: "+1 512-555-0155",
      addressLine1: "150 Elm Court",
      city: "Austin",
      state: "TX",
      postalCode: "78702",
      country: "United States",
    },
    {
      index: 9,
      name: "Tomas Berg",
      phone: "+1 503-555-0192",
      addressLine1: "45 Maple Lane",
      city: "Portland",
      state: "OR",
      postalCode: "97201",
      country: "United States",
    },
    {
      index: 10,
      name: "Elena Vasquez",
      phone: "+1 217-555-0171",
      addressLine1: "88 Baker Street",
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
      country: "United States",
    },
    {
      index: 11,
      name: "Chris Delgado",
      phone: "+1 305-555-0138",
      addressLine1: "300 Ocean Drive",
      addressLine2: "Unit 12",
      city: "Miami",
      state: "FL",
      postalCode: "33139",
      country: "United States",
    },
  ];

  for (const profile of profiles) {
    const customer = customers[profile.index];
    if (!customer) continue;
    const existing = await prisma.user.findUnique({ where: { id: customer.id }, select: { name: true } });
    if (existing?.name) continue; // idempotent — only fill in once
    await prisma.user.update({
      where: { id: customer.id },
      data: {
        name: profile.name,
        phone: profile.phone,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        country: profile.country,
      },
    });
  }
}

const BULK_FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
  "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
  "Daniel", "Nancy", "Matthew", "Lisa", "Anthony", "Betty", "Mark", "Margaret", "Paul", "Sandra",
  "Steven", "Ashley", "Andrew", "Kimberly", "Kenneth", "Emily", "Joshua", "Donna", "George", "Michelle",
];
const BULK_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
];
const BULK_CITIES: { city: string; state: string; country: string }[] = [
  { city: "Springfield", state: "IL", country: "United States" },
  { city: "Miami", state: "FL", country: "United States" },
  { city: "Seattle", state: "WA", country: "United States" },
  { city: "Austin", state: "TX", country: "United States" },
  { city: "Portland", state: "OR", country: "United States" },
  { city: "Denver", state: "CO", country: "United States" },
  { city: "Phoenix", state: "AZ", country: "United States" },
  { city: "Boston", state: "MA", country: "United States" },
  { city: "Nashville", state: "TN", country: "United States" },
  { city: "Minneapolis", state: "MN", country: "United States" },
];
const BULK_STREET_NAMES = [
  "Baker Street", "Ocean Drive", "Pine Ave", "Elm Court", "Maple Lane", "Cedar Road", "Birch Way",
  "Willow Street", "Sunset Blvd", "Highland Ave",
];

// Algorithmic version of seedCustomerProfileDetails for the
// BULK_CUSTOMER_COUNT customers — deterministic via the same mulberry32
// PRNG the bulk order generator already uses (see seedBulkOrders), so a
// reseed always produces the same names/addresses rather than a fresh
// random set every time. Not meant to be individually "realistic" the way
// the 12 curated profiles are (area codes aren't matched to the assigned
// city, for instance) — just enough variety that 168 rows don't look like
// a single templated stamp when scrolling the Customers list.
async function seedBulkCustomerProfiles(bulkCustomers: { id: number }[]) {
  const existing = await prisma.user.findUnique({ where: { id: bulkCustomers[0]?.id }, select: { name: true } });
  if (!bulkCustomers[0] || existing?.name) return; // idempotent — only fill in once

  const rand = mulberry32(20260901 + 1); // distinct seed from backfillCardMetadata's, still reproducible
  for (const customer of bulkCustomers) {
    const first = BULK_FIRST_NAMES[Math.floor(rand() * BULK_FIRST_NAMES.length)];
    const last = BULK_LAST_NAMES[Math.floor(rand() * BULK_LAST_NAMES.length)];
    const location = BULK_CITIES[Math.floor(rand() * BULK_CITIES.length)];
    const streetNumber = Math.floor(rand() * 9800) + 100;
    const streetName = BULK_STREET_NAMES[Math.floor(rand() * BULK_STREET_NAMES.length)];
    const areaCode = 200 + Math.floor(rand() * 700);
    const phoneLine = String(Math.floor(rand() * 10000)).padStart(4, "0");
    const postalCode = String(10000 + Math.floor(rand() * 89999));

    await prisma.user.update({
      where: { id: customer.id },
      data: {
        name: `${first} ${last}`,
        phone: `+1 ${areaCode}-555-${phoneLine}`,
        addressLine1: `${streetNumber} ${streetName}`,
        city: location.city,
        state: location.state,
        postalCode,
        country: location.country,
      },
    });
  }
}

// A spread of "still deciding, hasn't purchased yet" leads across several
// customers and products — demonstrates the Customer page's "Cart
// interest" section (and the Customers list's "In cart" column) with real
// variety, not just a handful buried on one page (see cartLead.service.ts
// — there's no real add-to-cart flow in this admin-only app, so every one
// of these is staff-logged, same reasoning as ReturnRequest/Review).
// Deliberately no note text — a real staff-logged lead is just "these
// items, this quantity," not an invented backstory.
async function seedCartLeadExamples(
  customers: { id: number }[],
  bulkCustomers: { id: number }[],
  variantsBySku: Map<string, number>
) {
  const existing = await prisma.cartLead.findFirst({ where: { userId: customers[2]?.id } });
  if (existing) return;

  const leads: {
    customerIndex: number;
    loggedByName: string;
    days: number;
    items: { sku: string; quantity: number }[];
  }[] = [
    {
      customerIndex: 2,
      loggedByName: "Fulfillment Staff",
      days: 3,
      items: [
        { sku: "HTR-INV-8KW", quantity: 1 },
        { sku: "STN-PERI-44LB", quantity: 2 },
        { sku: "CTL-TOUCH-BLK", quantity: 1 },
      ],
    },
    {
      customerIndex: 3,
      loggedByName: "Fulfillment Staff",
      days: 6,
      items: [
        { sku: "HTR-NORD-8KW", quantity: 1 },
        { sku: "STN-PERI-44LB", quantity: 2 },
      ],
    },
    {
      customerIndex: 5,
      loggedByName: "Admin",
      days: 1,
      items: [
        { sku: "CTL-TOUCH-BLK", quantity: 1 },
        { sku: "BNCH-ABACHI-6FT", quantity: 1 },
      ],
    },
    {
      customerIndex: 7,
      loggedByName: "Fulfillment Staff",
      days: 9,
      items: [
        { sku: "BNCH-ABACHI-7FT", quantity: 1 },
        { sku: "BCK-CEDAR-4FT", quantity: 2 },
      ],
    },
    {
      customerIndex: 8,
      loggedByName: "Fulfillment Staff",
      days: 2,
      items: [
        { sku: "DOOR-GLS-CLR", quantity: 1 },
        { sku: "ACC-BUCKET-CDR", quantity: 1 },
      ],
    },
    {
      customerIndex: 9,
      loggedByName: "Fulfillment Staff",
      days: 5,
      items: [
        { sku: "ACC-THERM-CDR", quantity: 1 },
        { sku: "LGT-FIBER-150", quantity: 1 },
        { sku: "ACC-BUCKET-CDR", quantity: 1 },
      ],
    },
  ];

  for (const lead of leads) {
    const customer = customers[lead.customerIndex];
    if (!customer) continue;

    const items = lead.items
      .map((line) => ({ variantId: variantsBySku.get(line.sku), quantity: line.quantity }))
      .filter((line): line is { variantId: number; quantity: number } => line.variantId !== undefined);
    if (items.length === 0) continue;

    await prisma.cartLead.create({
      data: {
        userId: customer.id,
        loggedByName: lead.loggedByName,
        createdAt: new Date(Date.now() - lead.days * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }

  // Bulk-pool leads — spreads more examples across the 168
  // BULK_CUSTOMER_COUNT customers (deterministic via mulberry32, same PRNG
  // the bulk order generator uses) so "In cart" isn't only visible on the
  // handful of curated customers above, which tend to sort onto later
  // pages of the Customers list.
  const allSkus = Array.from(variantsBySku.keys());
  const rand = mulberry32(20260901 + 2);
  const bulkLeadCount = Math.min(14, bulkCustomers.length);
  const bulkCustomerIndices = new Set<number>();
  while (bulkCustomerIndices.size < bulkLeadCount) {
    bulkCustomerIndices.add(Math.floor(rand() * bulkCustomers.length));
  }

  for (const index of bulkCustomerIndices) {
    const customer = bulkCustomers[index];
    const itemCount = 1 + Math.floor(rand() * 3); // 1-3 items per lead
    const skusForLead = new Set<string>();
    while (skusForLead.size < itemCount) {
      skusForLead.add(allSkus[Math.floor(rand() * allSkus.length)]);
    }

    const items = Array.from(skusForLead)
      .map((sku) => ({ variantId: variantsBySku.get(sku), quantity: 1 + Math.floor(rand() * 2) }))
      .filter((line): line is { variantId: number; quantity: number } => line.variantId !== undefined);
    if (items.length === 0) continue;

    await prisma.cartLead.create({
      data: {
        userId: customer.id,
        loggedByName: rand() > 0.5 ? "Fulfillment Staff" : "Admin",
        createdAt: new Date(Date.now() - Math.floor(rand() * 14) * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }
}

// Reviews and Q&A aren't tied to a specific order the way returns are —
// they're logged against a product directly (same "no live customer
// session yet, staff logs it" reasoning as ReturnRequest, see
// review.service.ts) — so this covers every status combination on a
// product-by-product basis rather than mirroring order examples 1:1.
async function seedReviewAndQuestionExamples() {
  const existing = await prisma.review.findFirst({ where: { body: { contains: "touch panel is intuitive" } } });
  if (existing) return;

  const slugs = [
    "nordic-electric-sauna-heater",
    "innova-digital-sauna-heater",
    "barrel-sauna-wood-heater",
    "finnish-peridotite-sauna-stones",
    "olivine-diabase-sauna-stones",
    "innova-touch-control-panel",
    "classic-analog-control-panel",
    "abachi-wood-sauna-bench-set",
    "cedar-contoured-backrest",
    "frameless-glass-sauna-door",
    "cedar-framed-glass-door",
    "fiber-optic-star-ceiling-kit",
    "sauna-bucket-ladle-set",
    "sauna-thermometer-hygrometer",
  ] as const;
  const products = Object.fromEntries(
    await Promise.all(
      slugs.map(async (slug) => [slug, await prisma.product.findUnique({ where: { slug } })] as const)
    )
  ) as Record<(typeof slugs)[number], { id: number; title: string } | null>;
  if (Object.values(products).some((p) => !p)) return;
  const p = products as Record<(typeof slugs)[number], { id: number; title: string }>;

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  // Reviews publish immediately (see review.service.ts's logReview) — but
  // ALSO require a real purchase there (Verified Purchase, same as any
  // major storefront), so seed data has to honor that too rather than just
  // attaching a made-up name. Looked up per product from real order
  // history (this runs after seedBulkOrders — see runSeed), same
  // PAID/SHIPPED/DELIVERED "counts as a completed sale" check the service
  // itself uses. A product with no genuine purchaser yet is skipped rather
  // than faked.
  const PURCHASED_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;
  async function findPurchaser(productId: number) {
    const order = await prisma.order.findFirst({
      where: { status: { in: [...PURCHASED_STATUSES] }, items: { some: { variant: { productId } } } },
      select: { user: { select: { id: true, email: true } } },
    });
    return order?.user ?? null;
  }

  // Mix of positive, mixed, and negative feedback across most of the
  // catalog, not just one product each, so the Reviews tab has enough
  // volume to actually test filtering/scrolling/deleting against. The
  // obvious spam one is kept on purpose so Delete has something real to
  // demonstrate against.
  const reviews: { slug: (typeof slugs)[number]; rating: number; body: string; days: number }[] = [
    {
      slug: "nordic-electric-sauna-heater",
      rating: 4,
      body: "Heats up fast and the touch panel is intuitive. Wish the door seal were a bit tighter.",
      days: 2,
    },
    {
      slug: "nordic-electric-sauna-heater",
      rating: 2,
      body: "Runs hotter than the room-size chart suggests — had to crack the door to avoid overheating our small cabin.",
      days: 18,
    },
    {
      slug: "innova-digital-sauna-heater",
      rating: 5,
      body: "Digital readout is a nice touch, install was straightforward with the included bracket.",
      days: 9,
    },
    {
      slug: "barrel-sauna-wood-heater",
      rating: 3,
      body: "Does the job but the wood smell was much stronger than expected the first few weeks.",
      days: 25,
    },
    {
      slug: "finnish-peridotite-sauna-stones",
      rating: 5,
      body: "Great steam, no cracking after three months of weekly use. Exactly the size I needed.",
      days: 5,
    },
    {
      slug: "olivine-diabase-sauna-stones",
      rating: 4,
      body: "Solid stones, though a few arrived with sharp edges — nothing a quick rinse and inspection didn't fix.",
      days: 14,
    },
    {
      slug: "innova-touch-control-panel",
      rating: 1,
      body: "buy bitcoin at www.totally-not-spam.example first heater ever made 100% real",
      days: 11,
    },
    {
      slug: "classic-analog-control-panel",
      rating: 5,
      body: "Simple, reliable, no software to fuss with. Exactly what I wanted after a smart panel died on me.",
      days: 30,
    },
    {
      slug: "abachi-wood-sauna-bench-set",
      rating: 2,
      body: "Bench slats are noticeably thinner than the photos imply — feels less sturdy than I'd like for the price.",
      days: 20,
    },
    {
      slug: "cedar-contoured-backrest",
      rating: 5,
      body: "The contour actually matters — much more comfortable than the flat backrest we replaced.",
      days: 6,
    },
    {
      slug: "frameless-glass-sauna-door",
      rating: 4,
      body: "Looks great and the seal is tight. Shipping had a small scare (box was dented) but the glass was fine.",
      days: 16,
    },
    {
      slug: "sauna-bucket-ladle-set",
      rating: 5,
      body: "Basic but well made — the ladle handle doesn't heat up like our old one did.",
      days: 3,
    },
    {
      slug: "sauna-thermometer-hygrometer",
      rating: 3,
      body: "Readings seem about 5 degrees off compared to a separate thermometer we already had.",
      days: 22,
    },
  ];
  for (const r of reviews) {
    const purchaser = await findPurchaser(p[r.slug].id);
    if (!purchaser) continue;
    await prisma.review.create({
      data: {
        productId: p[r.slug].id,
        userId: purchaser.id,
        authorName: purchaser.email,
        rating: r.rating,
        body: r.body,
        createdAt: daysAgo(r.days),
      },
    });
  }

  // Q&A — a spread of unanswered (sits in the queue) and answered
  // questions across several products, not just one pair, so there's
  // enough volume to test the unanswered filter and notification badges.
  const questions: {
    slug: (typeof slugs)[number];
    authorName: string;
    question: string;
    answer?: string;
    answeredByName?: string;
    days: number;
    answeredDays?: number;
    // When true, links this question to the same customer who reviewed
    // this product (found via findPurchaser above) instead of a made-up
    // name — demonstrates the "also left a review" / "also asked a
    // question" cross-reference on the Catalog page's Reviews & Q&A panel
    // with a real, matching customer rather than two disconnected people.
    linkToReviewer?: boolean;
  }[] = [
    {
      slug: "nordic-electric-sauna-heater",
      authorName: "Priya K.",
      question: "Can this run on a 220V single-phase supply, or does it need three-phase?",
      days: 1,
      linkToReviewer: true,
    },
    {
      slug: "finnish-peridotite-sauna-stones",
      authorName: "Owen L.",
      question: "How many kg do I need for an 8kW heater?",
      answer: "For an 8kW heater we recommend around 20kg (44lb) of stones — this bag is sized for that.",
      answeredByName: "Fulfillment Staff",
      days: 7,
      answeredDays: 6,
      linkToReviewer: true,
    },
    {
      slug: "barrel-sauna-wood-heater",
      authorName: "Hannah S.",
      question: "Is the barrel heater rated for outdoor/uncovered installation, or does it need a roof over it?",
      days: 4,
      linkToReviewer: true,
    },
    {
      slug: "innova-touch-control-panel",
      authorName: "Derek F.",
      question: "Does the touch panel support a delay-start timer, or only on/off?",
      answer: "It supports a delay-start of up to 4 hours — you'll find it under the clock icon in the settings menu.",
      answeredByName: "Admin",
      days: 13,
      answeredDays: 12,
      linkToReviewer: true,
    },
    {
      slug: "frameless-glass-sauna-door",
      authorName: "Miriam A.",
      question: "What's the standard rough opening size this door is built for?",
      days: 2,
      linkToReviewer: true,
    },
    {
      slug: "abachi-wood-sauna-bench-set",
      authorName: "Victor N.",
      question: "Can the bench set be cut down for a narrower cabin, or is it a fixed size?",
      answer: "The slats can be trimmed on-site — just keep the support frame spacing the same and it'll hold fine.",
      answeredByName: "Fulfillment Staff",
      days: 17,
      answeredDays: 15,
      linkToReviewer: true,
    },
  ];
  for (const q of questions) {
    const reviewer = q.linkToReviewer ? await findPurchaser(p[q.slug].id) : null;
    const created = await prisma.productQuestion.create({
      data: {
        productId: p[q.slug].id,
        userId: reviewer?.id,
        authorName: reviewer?.email ?? q.authorName,
        question: q.question,
        answer: q.answer,
        answeredByName: q.answeredByName,
        answeredAt: q.answer ? daysAgo(q.answeredDays!) : undefined,
        createdAt: daysAgo(q.days),
      },
    });
    if (!q.answer) {
      await prisma.notification.create({
        data: {
          type: "QUESTION_PENDING",
          dedupeKey: `question-${created.id}`,
          title: `New question — ${p[q.slug].title}`,
          body: created.question,
          link: `/catalog/${p[q.slug].id}`,
          createdAt: created.createdAt,
        },
      });
    }
  }
}

// Order notes on a couple of the plain flat-seeded orders (not just the
// hand-built refund examples) so the Notes UI shows realistic non-refund
// use too — shipping instructions, delivery follow-ups, etc.
async function seedNotesOnExistingOrders() {
  const shippedOrder = await prisma.order.findFirst({ where: { reference: "SAW-DOOR-0013" } });
  if (shippedOrder) {
    const already = await prisma.orderNote.findFirst({ where: { orderId: shippedOrder.id } });
    if (!already) {
      await prisma.orderNote.create({
        data: {
          orderId: shippedOrder.id,
          body: "Customer requested delivery be left at the side entrance, not the front porch.",
          authorName: "Fulfillment Staff",
          createdAt: shippedOrder.createdAt,
        },
      });
    }
  }

  const deliveredOrder = await prisma.order.findFirst({ where: { reference: "SAW-CTL-0019" } });
  if (deliveredOrder) {
    const already = await prisma.orderNote.findFirst({ where: { orderId: deliveredOrder.id } });
    if (!already) {
      await prisma.orderNote.create({
        data: {
          orderId: deliveredOrder.id,
          body: "Confirmed delivery by phone with customer — installer scheduled separately, not part of this order.",
          authorName: "Admin",
          createdAt: deliveredOrder.createdAt,
        },
      });
    }
  }
}

// Small deterministic PRNG (mulberry32) so re-running the seed always
// generates the exact same "random" bulk batch — required for idempotency,
// since a real Math.random() run would create a different dataset (and a
// different total order count) every time.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BULK_ORDER_COUNT = 800;
const BULK_REFERENCE_PREFIX = "SAW-BULK-";

// Rough approximation of how a real store's orders settle over time: most
// orders placed more than ~2 weeks ago have long since finished their
// lifecycle (delivered, or cancelled/returned/refunded early), while very
// recent orders are still mid-flight (pending/paid/shipped). Each entry is
// [status, relativeWeight].
const STATUS_WEIGHTS_OLD: [OrderStatus, number][] = [
  [OrderStatus.DELIVERED, 72],
  [OrderStatus.REFUNDED, 6],
  [OrderStatus.RETURNED, 5],
  [OrderStatus.CANCELLED, 5],
  [OrderStatus.SHIPPED, 2],
];
const STATUS_WEIGHTS_RECENT: [OrderStatus, number][] = [
  [OrderStatus.PENDING, 15],
  [OrderStatus.PAID, 30],
  [OrderStatus.SHIPPED, 30],
  [OrderStatus.DELIVERED, 15],
  [OrderStatus.CANCELLED, 10],
];

function weightedPick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CARD,
  PaymentMethod.PAYPAL,
  PaymentMethod.BANK,
  PaymentMethod.PAY_WITH_CHECK,
];

// A believable multi-stage timeline for a given final status, with each
// stage's timestamp interpolated between order placement and "now" (or the
// final status's own changedAt for terminal-but-not-fully-elapsed orders).
function buildStatusHistory(finalStatus: OrderStatus, placedAt: Date, resolvedAt: Date) {
  const span = resolvedAt.getTime() - placedAt.getTime();
  const at = (fraction: number) => new Date(placedAt.getTime() + span * fraction);

  switch (finalStatus) {
    case OrderStatus.PENDING:
      return [{ status: OrderStatus.PENDING, changedAt: placedAt }];
    case OrderStatus.CANCELLED:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.CANCELLED, changedAt: resolvedAt },
      ];
    case OrderStatus.PAID:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.PAID, changedAt: resolvedAt },
      ];
    case OrderStatus.SHIPPED:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.PAID, changedAt: at(0.3) },
        { status: OrderStatus.SHIPPED, changedAt: resolvedAt },
      ];
    case OrderStatus.DELIVERED:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.PAID, changedAt: at(0.2) },
        { status: OrderStatus.SHIPPED, changedAt: at(0.55) },
        { status: OrderStatus.DELIVERED, changedAt: resolvedAt },
      ];
    case OrderStatus.RETURNED:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.PAID, changedAt: at(0.15) },
        { status: OrderStatus.SHIPPED, changedAt: at(0.35) },
        { status: OrderStatus.DELIVERED, changedAt: at(0.6) },
        { status: OrderStatus.RETURNED, changedAt: resolvedAt },
      ];
    case OrderStatus.REFUNDED:
      return [
        { status: OrderStatus.PENDING, changedAt: placedAt },
        { status: OrderStatus.PAID, changedAt: at(0.15) },
        { status: OrderStatus.SHIPPED, changedAt: at(0.4) },
        { status: OrderStatus.REFUNDED, changedAt: resolvedAt },
      ];
    default:
      return [{ status: finalStatus, changedAt: resolvedAt }];
  }
}

// A large randomized (but deterministically-seeded) batch of ordinary
// orders spread across the past 12 months, so the admin panel looks like a
// real, active store rather than a dozen curated demo orders — enough
// volume for pagination, the statistics panel's trend, and CSV export to
// mean something. Complements (does not replace) the hand-crafted ORDERS
// list and the narrative refund examples above.
async function seedBulkOrders(customers: { id: number }[], variantsBySku: Map<string, number>) {
  const already = await prisma.order.findFirst({ where: { reference: { startsWith: BULK_REFERENCE_PREFIX } } });
  if (already) return;

  const rand = mulberry32(20260901);
  const priceBySku = new Map(
    PRODUCTS.flatMap((product) => product.variants.map((v) => [v.sku, v.priceCents] as const))
  );
  const allSkus = PRODUCTS.flatMap((product) => product.variants.map((v) => v.sku));
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Track cumulative units sold per SKU across the whole batch so stock can
  // be drawn down realistically at the end instead of per-order writes
  // (hundreds of extra UPDATE statements) or going negative.
  const soldBySku = new Map<string, number>();

  for (let i = 0; i < BULK_ORDER_COUNT; i++) {
    const daysAgo = Math.floor(rand() * 365);
    const placedAt = new Date(now - daysAgo * oneDayMs - Math.floor(rand() * oneDayMs));
    const isRecent = daysAgo < 14;
    const finalStatus = weightedPick(rand, isRecent ? STATUS_WEIGHTS_RECENT : STATUS_WEIGHTS_OLD);

    // Terminal orders resolve some time after placement (capped at "now");
    // still-open ones (PENDING) resolve "now" by definition.
    const resolveLagDays = Math.min(daysAgo, 1 + Math.floor(rand() * 10));
    const resolvedAt =
      finalStatus === OrderStatus.PENDING
        ? placedAt
        : new Date(Math.min(now, placedAt.getTime() + resolveLagDays * oneDayMs));

    const lineCount = 1 + Math.floor(rand() * 3);
    const skusInOrder = new Set<string>();
    while (skusInOrder.size < lineCount) {
      skusInOrder.add(allSkus[Math.floor(rand() * allSkus.length)]);
    }

    const lines = Array.from(skusInOrder).map((sku) => ({
      sku,
      quantity: 1 + Math.floor(rand() * 3),
    }));

    const items = lines.map((line) => {
      const unitPriceCents = priceBySku.get(line.sku)!;
      const variantId = variantsBySku.get(line.sku)!;
      return { variantId, quantity: line.quantity, unitPriceCents };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const shippingCents = subtotalCents >= 30000 ? 0 : 1500;
    const taxCents = Math.round(subtotalCents * 0.07);
    const totalCents = subtotalCents + shippingCents + taxCents;

    const customer = customers[Math.floor(rand() * customers.length)];
    const paymentMethod = weightedPick(
      rand,
      PAYMENT_METHODS.map((m) => [m, 1] as [PaymentMethod, number])
    );
    const hasPaymentIntent = finalStatus !== OrderStatus.PENDING && finalStatus !== OrderStatus.CANCELLED;
    const reference = `${BULK_REFERENCE_PREFIX}${String(i + 1).padStart(6, "0")}`;

    await prisma.order.create({
      data: {
        reference,
        status: finalStatus,
        paymentMethod,
        isNewClient: rand() < 0.25,
        userId: customer.id,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        stripePaymentIntentId: hasPaymentIntent ? `pi_bulk_${String(i + 1).padStart(6, "0")}` : undefined,
        paymentAttemptCount: hasPaymentIntent ? 1 : 0,
        shippingAddress: ADDRESSES[Math.floor(rand() * ADDRESSES.length)],
        trackingNumber:
          finalStatus === OrderStatus.SHIPPED ||
          finalStatus === OrderStatus.DELIVERED ||
          finalStatus === OrderStatus.RETURNED
            ? `1Z999BLK${String(100000000 + i)}`
            : undefined,
        createdAt: placedAt,
        items: { create: items },
        statusHistory: { create: buildStatusHistory(finalStatus, placedAt, resolvedAt) },
      },
    });

    // Stock only actually leaves the shelf once payment succeeds — a
    // PENDING or CANCELLED order never drew down inventory in the first
    // place (mirrors checkout()'s real reserve/release behavior).
    if (hasPaymentIntent) {
      for (const line of lines) {
        soldBySku.set(line.sku, (soldBySku.get(line.sku) ?? 0) + line.quantity);
      }
    }
  }

  // Apply the drawdown after generating all orders, floored so no variant's
  // displayed stock goes to zero or negative from a year of simulated sales
  // — a real store restocks; we're not modeling restocking events here, so
  // this floor just keeps Inventory looking plausible rather than empty.
  for (const [sku, soldQuantity] of soldBySku) {
    const variantId = variantsBySku.get(sku);
    if (!variantId) continue;
    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) continue;
    const floor = Math.max(3, Math.floor(inventory.stockQuantity * 0.15));
    const nextQuantity = Math.max(floor, inventory.stockQuantity - soldQuantity);
    await prisma.inventory.update({ where: { variantId }, data: { stockQuantity: nextQuantity } });
  }
}

async function seedSettings() {
  // Partial refunds default to off (see StoreSettings.allowPartialRefunds),
  // but the seed data now includes a real partially-refunded order — turn
  // the setting on so what's demonstrated in the data matches what the
  // admin UI shows as enabled, rather than seeding a feature's example data
  // while its own toggle claims to be off.
  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, allowPartialRefunds: true },
  });
}

// Reconstructs StockAdjustment rows for every order created before the
// Inventory module existed — without this, every variant's stock history
// panel would show "No stock changes recorded" despite 800+ orders having
// actually moved stock. Walks each order's real statusHistory/refunds
// (already seeded) to know WHEN each change happened and by how much, then
// works backwards from each variant's CURRENT stock to infer a consistent
// resultingQuantity at every step — the only way to reconstruct a real
// running total after the fact, since the adjustments themselves were never
// recorded when they happened.
// Card brand/last4/paymentStatus are normally only ever written by a real
// Stripe webhook (see payment.service.ts's recordCardMetadata) — seeded
// orders never go through Stripe, so without this they'd always show blank
// on the Customer page's Transactions table. Backfills plausible demo
// values (same "clearly fake, matches the rest of this seed file" spirit
// as SAW-BULK- references) onto every CARD-paid order that reached a real
// payment state, deterministic via the same mulberry32 PRNG the bulk order
// generator already uses so a reseed produces identical results.
const DEMO_CARD_BRANDS = ["visa", "mastercard", "amex", "discover"] as const;
const CARD_PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
  OrderStatus.RETURNED,
  OrderStatus.PARTIALLY_REFUNDED,
];

async function backfillCardMetadata() {
  const orders = await prisma.order.findMany({
    where: {
      paymentMethod: PaymentMethod.CARD,
      status: { in: CARD_PAID_STATUSES },
      stripePaymentIntentId: { not: null },
      cardBrand: null,
    },
    select: { id: true },
  });
  if (orders.length === 0) return;

  const rand = mulberry32(20260901);
  for (const order of orders) {
    const brand = DEMO_CARD_BRANDS[Math.floor(rand() * DEMO_CARD_BRANDS.length)];
    const last4 = String(Math.floor(rand() * 10000)).padStart(4, "0");
    await prisma.order.update({
      where: { id: order.id },
      data: { cardBrand: brand, cardLast4: last4, paymentStatus: "succeeded" },
    });
  }
}

async function backfillStockAdjustmentHistory() {
  const already = await prisma.stockAdjustment.findFirst({ where: { note: "Backfilled from order history" } });
  if (already) return;

  const orders = await prisma.order.findMany({
    include: { items: true, statusHistory: true, refunds: { include: { items: true } } },
  });

  // One chronological list of (variantId, delta, timestamp, reason, order)
  // events across every order, in the exact order inventory.service.ts's
  // real functions would have created them.
  interface Event {
    variantId: number;
    delta: number;
    at: Date;
    reason: StockAdjustmentReason;
    orderId: number;
    orderReference: string;
  }
  const events: Event[] = [];

  for (const order of orders) {
    const paidAt = order.statusHistory.find((h) => h.status === OrderStatus.PAID)?.changedAt;
    const returnedAt = order.statusHistory.find((h) => h.status === OrderStatus.RETURNED)?.changedAt;
    // A plain full refund (never partial) restocks everything at the moment
    // it reached REFUNDED — matches updateOrderStatus's blanket-restock
    // branch. Orders that went through PARTIALLY_REFUNDED already have
    // their restocks captured via order.refunds below instead.
    const refundedAt =
      order.status === OrderStatus.REFUNDED && order.refunds.length === 0
        ? order.statusHistory.find((h) => h.status === OrderStatus.REFUNDED)?.changedAt
        : undefined;

    if (paidAt) {
      for (const item of order.items) {
        events.push({
          variantId: item.variantId,
          delta: -item.quantity,
          at: paidAt,
          reason: StockAdjustmentReason.ORDER_SALE,
          orderId: order.id,
          orderReference: order.reference,
        });
      }
    }
    if (returnedAt || refundedAt) {
      for (const item of order.items) {
        events.push({
          variantId: item.variantId,
          delta: item.quantity,
          at: (returnedAt ?? refundedAt)!,
          reason: returnedAt ? StockAdjustmentReason.ORDER_RETURN : StockAdjustmentReason.REFUND_RESTOCK,
          orderId: order.id,
          orderReference: order.reference,
        });
      }
    }
    // Partial (or partial-then-completing) refunds already recorded exactly
    // which item/quantity was restocked and when via RefundRecord — reuse
    // that instead of re-deriving it.
    for (const refund of order.refunds) {
      for (const line of refund.items) {
        const item = order.items.find((i) => i.id === line.orderItemId);
        if (!item) continue;
        events.push({
          variantId: item.variantId,
          delta: line.quantity,
          at: refund.createdAt,
          reason: StockAdjustmentReason.REFUND_RESTOCK,
          orderId: order.id,
          orderReference: order.reference,
        });
      }
    }
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Work out where each variant's running total STARTS: current stock minus
  // the sum of every delta about to be replayed. Then replay forward,
  // writing a resultingQuantity at each step that is internally consistent
  // and lands exactly on today's real stock number at the end.
  const currentStock = new Map<number, number>();
  for (const inventory of await prisma.inventory.findMany()) {
    currentStock.set(inventory.variantId, inventory.stockQuantity);
  }
  const netDeltaByVariant = new Map<number, number>();
  for (const event of events) {
    netDeltaByVariant.set(event.variantId, (netDeltaByVariant.get(event.variantId) ?? 0) + event.delta);
  }
  const runningTotal = new Map<number, number>();
  for (const [variantId, current] of currentStock) {
    runningTotal.set(variantId, current - (netDeltaByVariant.get(variantId) ?? 0));
  }

  const rows = events.map((event) => {
    const before = runningTotal.get(event.variantId) ?? 0;
    const after = before + event.delta;
    runningTotal.set(event.variantId, after);
    return {
      variantId: event.variantId,
      reason: event.reason,
      deltaQuantity: event.delta,
      resultingQuantity: after,
      note: "Backfilled from order history",
      orderId: event.orderId,
      orderReference: event.orderReference,
      createdAt: event.at,
    };
  });

  if (rows.length > 0) {
    await prisma.stockAdjustment.createMany({ data: rows });
  }
}

// The actual seeding work, callable both from the CLI entry point
// (prisma/seed.ts, run via npm run db:seed) and in-process from the API
// server (Configuration -> "Reset seed data"). Returns a human-readable
// summary string rather than just console.logging it, so a caller other
// than the CLI (e.g. an API route building a JSON response) can surface the
// same message.
export async function runSeed(): Promise<string> {
  await seedAdmins();
  await seedSettings();
  const customers = await seedCustomers();
  const bulkCustomers = await seedBulkCustomers();
  await seedCustomerProfileDetails(customers);
  await seedBulkCustomerProfiles(bulkCustomers);
  const variantsBySku = await seedCatalog();
  await seedOrders(customers, variantsBySku);
  await seedCartLeadExamples(customers, bulkCustomers, variantsBySku);
  await seedPartialRefundExample(customers, variantsBySku);
  await seedMoreOrderExamples(customers, variantsBySku);
  await seedReturnRequestExamples(customers, variantsBySku);
  await seedNotesOnExistingOrders();
  await seedBulkOrders([...customers, ...bulkCustomers], variantsBySku);
  // Runs after seedBulkOrders — reviews now require a real purchase (see
  // review.service.ts's logReview), so there needs to be purchase history
  // to attach them to first.
  await seedReviewAndQuestionExamples();
  await backfillCardMetadata();
  await backfillStockAdjustmentHistory();

  const productCount = PRODUCTS.length;
  const variantCount = PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0);
  const totalCustomers = customers.length + bulkCustomers.length;
  const totalOrders = ORDERS.length + 6 + BULK_ORDER_COUNT;
  return (
    `Seeded admin user (admin / admin123), staff user (staff / staff123), ${totalCustomers} customers, ` +
    `${CATEGORIES.length} categories, ${productCount} products (${variantCount} variants), ${totalOrders} orders total ` +
    `(${BULK_ORDER_COUNT} bulk-generated over the past 12 months, 3 hand-crafted refund examples, 3 return-request ` +
    `examples covering pending/approved/rejected, and ${ORDERS.length} curated demo orders), 4 order notes, ` +
    `13 product reviews spanning the catalog (published immediately, mixed ratings, one obvious spam ` +
    `example demonstrating the delete flow), 6 product questions covering unanswered/answered, all ` +
    `${totalCustomers} customers with full profile detail (name/phone/address — ${CUSTOMER_COUNT} hand-picked, ` +
    `${bulkCustomers.length} algorithmically generated), demo card metadata backfilled onto every card-paid ` +
    `completed order, 20 cart-interest leads spread across curated and bulk customers (most holding ` +
    `multiple products), ` +
    `and enabled partial refunds in store settings.`
  );
}
