import { PrismaClient, Role, UserStatus, ShopStatus, ProductStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.user.upsert({
    where: { mobileNumber: "9000000000" },
    update: {},
    create: {
      name: "Super Admin",
      mobileNumber: "9000000000",
      email: "admin@cakeconnect.in",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  });

  const owner = await prisma.user.upsert({
    where: { mobileNumber: "9111111111" },
    update: {},
    create: {
      name: "Ramesh Shop Owner",
      mobileNumber: "9111111111",
      email: "owner@cakeconnect.in",
      role: Role.SHOP_OWNER,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  });

  const shop1 = await prisma.shop.upsert({
    where: { shopCode: "CC001" },
    update: {},
    create: {
      shopCode: "CC001",
      shopName: "CakeConnect Main Bakery",
      ownerId: owner.id,
      mobileNumber: "9111111111",
      email: "main@bakery.in",
      address: "MG Road, Bengaluru",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      gstin: "29ABCDE1234F1Z5",
      creditLimit: 50000,
      currentOutstanding: 0,
      status: ShopStatus.ACTIVE,
    },
  });

  const shop2 = await prisma.shop.upsert({
    where: { shopCode: "CC002" },
    update: {},
    create: {
      shopCode: "CC002",
      shopName: "CakeConnect Koramangala",
      mobileNumber: "9222222222",
      email: "koramangala@bakery.in",
      address: "100 Feet Rd, Koramangala",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560034",
      creditLimit: 30000,
      currentOutstanding: 0,
      status: ShopStatus.ACTIVE,
    },
  });

  await prisma.shopUser.upsert({
    where: { shopId_userId: { shopId: shop1.id, userId: owner.id } },
    update: { isPrimary: true },
    create: { shopId: shop1.id, userId: owner.id, isPrimary: true },
  });

  const cakeCat = await prisma.category.upsert({
    where: { name: "Cakes" },
    update: {},
    create: { name: "Cakes", description: "Celebration cakes", isActive: true },
  });

  const pastryCat = await prisma.category.upsert({
    where: { name: "Pastries" },
    update: {},
    create: { name: "Pastries", description: "Cupcakes and pastries", isActive: true },
  });

  const products = [
    { sku: "SKU-CHOC", name: "Chocolate Truffle Cake", categoryId: cakeCat.id, price: 850, basePrice: 500, unit: "kg" },
    { sku: "SKU-REDV", name: "Red Velvet Cake", categoryId: cakeCat.id, price: 950, basePrice: 560, unit: "kg" },
    { sku: "SKU-CUP6", name: "Chocolate Cupcake (Box of 6)", categoryId: pastryCat.id, price: 360, basePrice: 210, unit: "box" },
    { sku: "SKU-CUPV6", name: "Vanilla Cupcake (Box of 6)", categoryId: pastryCat.id, price: 330, basePrice: 190, unit: "box" },
  ];

  let priceList = await prisma.priceList.findFirst({
    where: { name: "Network Default Price List" },
  });
  if (!priceList) {
    priceList = await prisma.priceList.create({
      data: {
        name: "Network Default Price List",
        description: "Default prices for all shops",
        isActive: true,
      },
    });
  }

  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        description: p.name,
        unit: p.unit,
        basePrice: p.basePrice,
        status: ProductStatus.ACTIVE,
      },
    });
    await prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId: priceList.id, productId: prod.id } },
      update: { price: p.price },
      create: {
        priceListId: priceList.id,
        productId: prod.id,
        price: p.price,
      },
    });
  }

  await prisma.shopPriceList.upsert({
    where: { shopId_priceListId: { shopId: shop1.id, priceListId: priceList.id } },
    update: {},
    create: { shopId: shop1.id, priceListId: priceList.id },
  });

  console.log("Seed complete:");
  console.log(`  Admin:  9000000000 / Admin@123 (ADMIN)`);
  console.log(`  Owner:  9111111111 / Admin@123 (SHOP_OWNER)`);
  console.log(`  Shops:  ${shop1.shopCode}, ${shop2.shopCode}`);
  console.log(`  Price list: ${priceList.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
