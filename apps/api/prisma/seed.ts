import { PrismaClient, OrderStatus, PaymentMethod, AdminRole } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

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

interface VariantSeed {
  sku: string;
  priceCents: number;
  attributes: Record<string, string>;
  stockQuantity: number;
}

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
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantSeed.sku },
        update: {},
        create: {
          sku: variantSeed.sku,
          priceCents: variantSeed.priceCents,
          attributes: variantSeed.attributes,
          productId: product.id,
          inventory: { create: { stockQuantity: variantSeed.stockQuantity } },
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
      },
    });
  }
}

async function main() {
  await seedAdmins();
  const customers = await seedCustomers();
  const variantsBySku = await seedCatalog();
  await seedOrders(customers, variantsBySku);

  const productCount = PRODUCTS.length;
  const variantCount = PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0);
  console.log(
    `Seeded admin user (admin / admin123), staff user (staff / staff123), ${customers.length} customers, ` +
      `${CATEGORIES.length} categories, ${productCount} products (${variantCount} variants), and ${ORDERS.length} orders.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
