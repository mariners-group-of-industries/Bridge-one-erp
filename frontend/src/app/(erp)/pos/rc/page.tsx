"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  CheckCircle,
  ChefHat,
  Cookie,
  FileSpreadsheet,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";

// ============================================================================
// TYPES & DATA STRUCTURES (From Marinozz_Standard_Recipe_and_Costing_Template.xlsx)
// ============================================================================

type RcTabId =
  | "MENU_SUMMARY"
  | "INGREDIENT_MASTER"
  | "EXAMPLE_RESTAURANT"
  | "EXAMPLE_PANTOA"
  | "RECIPE_TEMPLATE"
  | "READ_ME";

export interface IngredientMasterItem {
  code: string;
  name: string;
  category: string;
  purchasePack: string;
  packNetContent: number;
  baseUnit: "g" | "ml" | "pc";
  packCostBdt: number;
  usableYieldPct: number; // e.g. 1.0 = 100%, 0.95 = 95%
  preferredSupplier: string;
  allergensNote: string;
  rateUpdated: string;
}

export interface RecipeIngredientLine {
  id: string;
  ingredientCode: string;
  netQtyPerBatch: number;
  cutPrepSpec: string;
}

export interface RecipeSop {
  miseEnPlace: string;
  steps: string[]; // Step 1 to Step 8
  finishGarnishPortioning: string;
  servingPackingStandard: string;
  storageHoldingInstruction: string;
  foodSafetyCriticalQc: string;
  allergensCrossContact: string;
  equipmentTools: string;
  chefNotesApproval: string;
}

export interface RecipeSheetData {
  id: string;
  tabKey: "EXAMPLE_RESTAURANT" | "EXAMPLE_PANTOA" | "RECIPE_TEMPLATE";
  recipeId: string;
  productName: string;
  brandBusiness: string;
  category: string;
  version: string;
  sellableBatchYield: number;
  yieldUnit: string;
  portionDescription: string;
  servingSize: number;
  sizeUnit: string;
  prepTimeMin: number;
  cookTimeMin: number;
  approvalDate: string;
  preparedBy: string;
  approvedBy: string;
  revisionDate: string;
  lines: RecipeIngredientLine[];
  // Section A: Batch Production Cost Inputs
  extraBatchWastagePct: number; // e.g. 0.03 = 3%
  packagingPerServing: number; // BDT
  directLabourPerBatch: number; // BDT
  utilitiesPerBatch: number; // BDT
  overheadPerBatch: number; // BDT
  // Section B: Pricing & Contribution Inputs
  desiredContributionMarginPct: number; // e.g. 0.60 = 60%
  vatTaxPct: number; // e.g. 0 = 0%
  actualMenuPrice: number; // BDT
  // Section C: SOP
  sop: RecipeSop;
}

// ============================================================================
// INITIAL DATA FROM EXCEL WORKBOOK
// ============================================================================

const INITIAL_INGREDIENTS: IngredientMasterItem[] = [
  {
    code: "ING001",
    name: "Rice (raw)",
    category: "Dry groceries",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 120,
    usableYieldPct: 1.0,
    preferredSupplier: "Grain supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING002",
    name: "Chicken, boneless",
    category: "Protein",
    purchasePack: "1 kg pack",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 320,
    usableYieldPct: 0.95,
    preferredSupplier: "Meat supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING003",
    name: "Mixed vegetables",
    category: "Vegetables",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 180,
    usableYieldPct: 0.9,
    preferredSupplier: "Produce supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING004",
    name: "Egg, medium",
    category: "Protein",
    purchasePack: "12 pc tray",
    packNetContent: 12,
    baseUnit: "pc",
    packCostBdt: 144,
    usableYieldPct: 1.0,
    preferredSupplier: "Poultry supplier",
    allergensNote: "Egg",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING005",
    name: "Soy sauce",
    category: "Sauces",
    purchasePack: "1 litre bottle",
    packNetContent: 1000,
    baseUnit: "ml",
    packCostBdt: 160,
    usableYieldPct: 1.0,
    preferredSupplier: "Sauce supplier",
    allergensNote: "Soy, wheat (check label)",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING006",
    name: "Cooking oil",
    category: "Oils",
    purchasePack: "5 litre can",
    packNetContent: 5000,
    baseUnit: "ml",
    packCostBdt: 900,
    usableYieldPct: 1.0,
    preferredSupplier: "Oil supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING007",
    name: "Garlic",
    category: "Vegetables",
    purchasePack: "500 g bag",
    packNetContent: 500,
    baseUnit: "g",
    packCostBdt: 90,
    usableYieldPct: 0.9,
    preferredSupplier: "Produce supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING008",
    name: "Onion",
    category: "Vegetables",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 65,
    usableYieldPct: 0.9,
    preferredSupplier: "Produce supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING009",
    name: "Salt",
    category: "Seasoning",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 35,
    usableYieldPct: 1.0,
    preferredSupplier: "Groceries",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING010",
    name: "Black pepper",
    category: "Seasoning",
    purchasePack: "100 g pack",
    packNetContent: 100,
    baseUnit: "g",
    packCostBdt: 130,
    usableYieldPct: 1.0,
    preferredSupplier: "Spice supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING011",
    name: "All-purpose flour",
    category: "Dry groceries",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 65,
    usableYieldPct: 1.0,
    preferredSupplier: "Flour supplier",
    allergensNote: "Wheat / gluten",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING012",
    name: "Sugar",
    category: "Dry groceries",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 110,
    usableYieldPct: 1.0,
    preferredSupplier: "Sugar supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING013",
    name: "Butter",
    category: "Dairy",
    purchasePack: "500 g block",
    packNetContent: 500,
    baseUnit: "g",
    packCostBdt: 550,
    usableYieldPct: 1.0,
    preferredSupplier: "Dairy supplier",
    allergensNote: "Milk",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING014",
    name: "Milk",
    category: "Dairy",
    purchasePack: "1 litre carton",
    packNetContent: 1000,
    baseUnit: "ml",
    packCostBdt: 100,
    usableYieldPct: 1.0,
    preferredSupplier: "Dairy supplier",
    allergensNote: "Milk",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING015",
    name: "Baking powder",
    category: "Baking",
    purchasePack: "100 g tin",
    packNetContent: 100,
    baseUnit: "g",
    packCostBdt: 70,
    usableYieldPct: 1.0,
    preferredSupplier: "Baking supplier",
    allergensNote: "Check label",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING016",
    name: "Vanilla essence",
    category: "Flavour",
    purchasePack: "100 ml bottle",
    packNetContent: 100,
    baseUnit: "ml",
    packCostBdt: 190,
    usableYieldPct: 1.0,
    preferredSupplier: "Baking supplier",
    allergensNote: "Check label",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING017",
    name: "Cardamom powder",
    category: "Seasoning",
    purchasePack: "50 g pack",
    packNetContent: 50,
    baseUnit: "g",
    packCostBdt: 170,
    usableYieldPct: 1.0,
    preferredSupplier: "Spice supplier",
    allergensNote: "",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING018",
    name: "Disposable serving tray",
    category: "Packaging",
    purchasePack: "100 pcs pack",
    packNetContent: 100,
    baseUnit: "pc",
    packCostBdt: 300,
    usableYieldPct: 1.0,
    preferredSupplier: "Packaging supplier",
    allergensNote: "Food-grade",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING019",
    name: "Ghee",
    category: "Dairy",
    purchasePack: "500 g jar",
    packNetContent: 500,
    baseUnit: "g",
    packCostBdt: 720,
    usableYieldPct: 1.0,
    preferredSupplier: "Dairy supplier",
    allergensNote: "Milk",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING020",
    name: "Chhana / fresh curd",
    category: "Dairy",
    purchasePack: "1 kg pack",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 450,
    usableYieldPct: 0.95,
    preferredSupplier: "Dairy supplier",
    allergensNote: "Milk",
    rateUpdated: "2026-11-01",
  },
  {
    code: "ING021",
    name: "Semolina",
    category: "Dry groceries",
    purchasePack: "1 kg bag",
    packNetContent: 1000,
    baseUnit: "g",
    packCostBdt: 85,
    usableYieldPct: 1.0,
    preferredSupplier: "Grain supplier",
    allergensNote: "Wheat / gluten",
    rateUpdated: "2026-11-01",
  },
];

const INITIAL_RECIPES: RecipeSheetData[] = [
  {
    id: "rcp-rest-001",
    tabKey: "EXAMPLE_RESTAURANT",
    recipeId: "MRZ-FD-001",
    productName: "Chicken Fried Rice",
    brandBusiness: "Marinozz Restaurant",
    category: "Main Course",
    version: "1.0",
    sellableBatchYield: 10,
    yieldUnit: "plates",
    portionDescription: "1 plated serving",
    servingSize: 320,
    sizeUnit: "g",
    prepTimeMin: 30,
    cookTimeMin: 25,
    approvalDate: "2026-11-01",
    preparedBy: "Kitchen R&D",
    approvedBy: "QC / Management",
    revisionDate: "2026-11-01",
    lines: [
      { id: "l-1", ingredientCode: "ING001", netQtyPerBatch: 1200, cutPrepSpec: "Wash, cook and cool rice per SOP" },
      { id: "l-2", ingredientCode: "ING002", netQtyPerBatch: 800, cutPrepSpec: "Dice to uniform small pieces" },
      { id: "l-3", ingredientCode: "ING003", netQtyPerBatch: 600, cutPrepSpec: "Clean and portion, edible weight" },
      { id: "l-4", ingredientCode: "ING004", netQtyPerBatch: 8, cutPrepSpec: "Break and beat" },
      { id: "l-5", ingredientCode: "ING005", netQtyPerBatch: 150, cutPrepSpec: "Measure in ml" },
      { id: "l-6", ingredientCode: "ING006", netQtyPerBatch: 200, cutPrepSpec: "Measure in ml" },
      { id: "l-7", ingredientCode: "ING007", netQtyPerBatch: 70, cutPrepSpec: "Minced; edible weight" },
      { id: "l-8", ingredientCode: "ING008", netQtyPerBatch: 150, cutPrepSpec: "Chopped; edible weight" },
      { id: "l-9", ingredientCode: "ING009", netQtyPerBatch: 30, cutPrepSpec: "Measure weight" },
      { id: "l-10", ingredientCode: "ING010", netQtyPerBatch: 12, cutPrepSpec: "Finely ground" },
    ],
    extraBatchWastagePct: 0.03,
    packagingPerServing: 7,
    directLabourPerBatch: 120,
    utilitiesPerBatch: 70,
    overheadPerBatch: 100,
    desiredContributionMarginPct: 0.6,
    vatTaxPct: 0,
    actualMenuPrice: 299,
    sop: {
      miseEnPlace: "Confirm cleaned stations and calibrated scales. Wash vegetables; prepare cooked rice and ingredients safely.",
      steps: [
        "Prepare all ingredients to the weighed, net usable quantities on this card.",
        "Heat pan/wok and add measured oil; cook chicken thoroughly to a safe core temperature.",
        "Add garlic and onion; sauté, then mix vegetables.",
        "Cook eggs separately or in the wok until set.",
        "Add rice, sauce, seasoning; toss to distribute evenly and heat fully.",
        "Check taste, colour and portion yield; adjust only by approved recipe revision.",
        "Portion exactly 10 plates. Record deviations and wastage.",
        "Clean and sanitise station; return suitable food to temperature-controlled holding promptly.",
      ],
      finishGarnishPortioning: "Serve hot with the approved presentation and garnish standard.",
      servingPackingStandard: "Use the approved food-safe container for takeaway; packaging cost is entered separately.",
      storageHoldingInstruction: "Follow site-specific safe hot/cold holding and maximum holding-time procedures.",
      foodSafetyCriticalQc: "Verify poultry fully cooked, no cross-contamination, clean utensils, correct portion sizes.",
      allergensCrossContact: "Egg, soy; sauce may contain wheat/gluten. Confirm the exact supplier label.",
      equipmentTools: "Food-grade pans, wok, ladle, food thermometer, calibrated scales.",
      chefNotesApproval: "All prices are examples; validate locally before commercial use.",
    },
  },
  {
    id: "rcp-pnt-001",
    tabKey: "EXAMPLE_PANTOA",
    recipeId: "PNT-BK-001",
    productName: "Butter Cookies",
    brandBusiness: "Pantoa (Confectionery)",
    category: "Cookies / Bakery",
    version: "1.0",
    sellableBatchYield: 100,
    yieldUnit: "pieces",
    portionDescription: "1 standard butter cookie",
    servingSize: 21,
    sizeUnit: "g",
    prepTimeMin: 40,
    cookTimeMin: 20,
    approvalDate: "2026-11-01",
    preparedBy: "Bakery R&D",
    approvedBy: "QC / Management",
    revisionDate: "2026-11-01",
    lines: [
      { id: "p-1", ingredientCode: "ING011", netQtyPerBatch: 1000, cutPrepSpec: "Sift flour" },
      { id: "p-2", ingredientCode: "ING013", netQtyPerBatch: 500, cutPrepSpec: "Softened, food-safe temperature" },
      { id: "p-3", ingredientCode: "ING012", netQtyPerBatch: 300, cutPrepSpec: "Fine sugar" },
      { id: "p-4", ingredientCode: "ING004", netQtyPerBatch: 4, cutPrepSpec: "Approx. 4 medium eggs" },
      { id: "p-5", ingredientCode: "ING016", netQtyPerBatch: 8, cutPrepSpec: "Measure in ml" },
      { id: "p-6", ingredientCode: "ING015", netQtyPerBatch: 10, cutPrepSpec: "Sift with flour" },
      { id: "p-7", ingredientCode: "ING009", netQtyPerBatch: 5, cutPrepSpec: "Fine salt" },
    ],
    extraBatchWastagePct: 0.03,
    packagingPerServing: 1.5,
    directLabourPerBatch: 160,
    utilitiesPerBatch: 65,
    overheadPerBatch: 80,
    desiredContributionMarginPct: 0.55,
    vatTaxPct: 0,
    actualMenuPrice: 35,
    sop: {
      miseEnPlace: "Sanitize equipment, check ingredient shelf life and verify baking trays and oven cleanliness.",
      steps: [
        "Weigh flour, butter, sugar, egg, vanilla, baking powder and salt precisely.",
        "Cream softened butter with sugar until consistent, following R&D mixing standard.",
        "Incorporate eggs and vanilla evenly; avoid overmixing.",
        "Combine dry ingredients; mix into uniform dough.",
        "Shape into 100 equal-weight pieces on lined trays.",
        "Bake according to validated oven settings; monitor colour and core doneness.",
        "Cool completely on food-safe racks before packaging.",
        "Reject burnt or broken units according to QC tolerance.",
      ],
      finishGarnishPortioning: "Deliver uniform size, texture, golden finish and exact unit count.",
      servingPackingStandard: "Package in approved food-safe material after adequate cooling.",
      storageHoldingInstruction: "Store sealed in clean, dry conditions; set expiry only after validated shelf-life testing.",
      foodSafetyCriticalQc: "Check oven calibration, weight tolerance, allergen controls, packaging integrity.",
      allergensCrossContact: "Contains wheat/gluten, milk and egg. Prevent cross-contact.",
      equipmentTools: "Mixing bowl, mixer, calibrated scale, baking trays, oven, racks.",
      chefNotesApproval: "Sample formula and prices only; adapt after R&D and sensory verification.",
    },
  },
  {
    id: "rcp-tpl-001",
    tabKey: "RECIPE_TEMPLATE",
    recipeId: "PNT-SW-002",
    productName: "Classic Pantoa (Chhana Sweet)",
    brandBusiness: "Marinozz / Pantoa",
    category: "Traditional Sweets",
    version: "1.0",
    sellableBatchYield: 50,
    yieldUnit: "pieces",
    portionDescription: "1 syrup-soaked pantoa",
    servingSize: 45,
    sizeUnit: "g",
    prepTimeMin: 25,
    cookTimeMin: 30,
    approvalDate: "2026-11-03",
    preparedBy: "Sweetmeat R&D",
    approvedBy: "QC / Management",
    revisionDate: "2026-11-03",
    lines: [
      { id: "t-1", ingredientCode: "ING020", netQtyPerBatch: 1000, cutPrepSpec: "Knead chhana until smooth" },
      { id: "t-2", ingredientCode: "ING021", netQtyPerBatch: 150, cutPrepSpec: "Fine semolina for binding" },
      { id: "t-3", ingredientCode: "ING011", netQtyPerBatch: 100, cutPrepSpec: "Sifted flour" },
      { id: "t-4", ingredientCode: "ING019", netQtyPerBatch: 250, cutPrepSpec: "Pure ghee for kneading & frying" },
      { id: "t-5", ingredientCode: "ING012", netQtyPerBatch: 1200, cutPrepSpec: "For medium-consistency sugar syrup" },
      { id: "t-6", ingredientCode: "ING017", netQtyPerBatch: 15, cutPrepSpec: "Crushed green cardamom" },
      { id: "t-7", ingredientCode: "ING015", netQtyPerBatch: 8, cutPrepSpec: "Leavening agent" },
    ],
    extraBatchWastagePct: 0.02,
    packagingPerServing: 2.0,
    directLabourPerBatch: 140,
    utilitiesPerBatch: 80,
    overheadPerBatch: 90,
    desiredContributionMarginPct: 0.55,
    vatTaxPct: 0,
    actualMenuPrice: 45,
    sop: {
      miseEnPlace: "Prepare fresh chhana, measure sugar for syrup, and heat frying pan with ghee/oil blend.",
      steps: [
        "Knead fresh chhana, semolina, flour, baking powder and cardamom into a smooth, crack-free dough.",
        "Divide dough into 50 equal portions (approx. 25g raw weight each) and roll into smooth balls/cylinders.",
        "Prepare sugar syrup with water and cardamom; maintain warm simmering temperature.",
        "Deep-fry balls on low-to-medium heat until deep golden-brown all over.",
        "Drain excess fat briefly and transfer hot fried balls directly into warm sugar syrup.",
        "Soak for minimum 2 hours until soft, spongy, and syrup-infused.",
        "Inspect size, softness, and syrup absorption across batch.",
        "Transfer to food-grade display trays under hygienic temperature control.",
      ],
      finishGarnishPortioning: "Serve warm or room temperature with light syrup glaze and pistachio/cardamom garnish.",
      servingPackingStandard: "Food-grade sweet box with leak-resistant liner.",
      storageHoldingInstruction: "Chilled display after 6 hours; shelf life 48 hours under refrigeration.",
      foodSafetyCriticalQc: "Verify dairy freshness, frying oil TPM limits, and syrup Brix consistency.",
      allergensCrossContact: "Contains milk (chhana, ghee) and wheat/gluten (flour, semolina).",
      equipmentTools: "Heavy kadai, perforated strainer, syrup pot, digital scale, thermometer.",
      chefNotesApproval: "Editable template pre-loaded with Pantoa example — modify or clear any field to test custom recipes.",
    },
  },
];

const WORKBOOK_INSTRUCTIONS = [
  {
    step: "01",
    title: "Ingredient Master",
    desc: "Enter purchase pack sizes, supplier prices and usable yield. Enter quantity in g, ml or pc consistently.",
  },
  {
    step: "02",
    title: "Recipe Template",
    desc: "Duplicate this sheet for each menu product. Fill in SKU codes, net usable recipe quantities, yield and production SOP.",
  },
  {
    step: "03",
    title: "Recipe cost calculation",
    desc: "Unit costs flow from Ingredient Master; batch and per-serving costs calculate automatically.",
  },
  {
    step: "04",
    title: "Selling price",
    desc: "Set a desired contribution margin and any applicable VAT/tax. Enter actual menu price to compare outcomes.",
  },
  {
    step: "05",
    title: "Examples",
    desc: "Review Example Restaurant (fried rice) and Example Pantoa (butter cookies). Sample rates are hypothetical only.",
  },
  {
    step: "06",
    title: "Management review",
    desc: "Use Menu Cost Summary for the examples and extend it by linking additional recipe tabs before approval.",
  },
];

const FORMULAS_CONTROL_POINTS = [
  {
    metric: "Usable unit cost",
    formula: "Purchase pack price ÷ (pack net content × usable yield %)",
  },
  {
    metric: "Recipe ingredient cost",
    formula: "Net usable recipe quantity × usable unit cost",
  },
  {
    metric: "Batch production cost",
    formula: "Ingredients + wastage allowance + packaging + labour + utilities + overhead",
  },
  {
    metric: "Cost per serving",
    formula: "Total batch production cost ÷ sellable servings/units per batch",
  },
  {
    metric: "Suggested selling price, before VAT",
    formula: "Cost per serving ÷ (1 − desired contribution margin %)",
  },
  {
    metric: "Contribution margin",
    formula: "(Net menu selling price − cost per serving) ÷ net menu selling price",
  },
];

const KEY_OPERATING_GUIDELINES = [
  "1. Validate every purchase price and usable yield against supplier invoices / purchase records.",
  "2. Use sellable finished pieces or portions after processing as the Batch Yield.",
  "3. Include actual approved costs for packaging, labour, utilities and overhead per production batch.",
  "4. Review menu VAT/tax only as legally applicable; enter actual consumer price separately.",
  "5. Review food cost ratio, contribution margin, allergies, holding controls and authorization before release.",
];

// ============================================================================
// HELPER CALCULATION ENGINE
// ============================================================================

function computeUsableUnitCost(ing: IngredientMasterItem): number {
  const denom = ing.packNetContent * ing.usableYieldPct;
  if (!denom || denom <= 0) return 0;
  return ing.packCostBdt / denom;
}

export interface ComputedRecipeMetrics {
  enrichedLines: Array<{
    id: string;
    ingredientCode: string;
    ingredientName: string;
    category: string;
    unit: string;
    netQtyPerBatch: number;
    unitCostBdt: number;
    batchCostBdt: number;
    costPerServing: number;
    cutPrepSpec: string;
    supplier: string;
    allergenWarning: string;
    isValid: boolean;
  }>;
  totalIngredientBatchCost: number;
  ingredientCostPerServing: number;
  extraWastageAmount: number;
  totalPackagingCost: number;
  totalBatchCost: number;
  costPerServing: number;
  suggestedPriceExclVat: number;
  suggestedCustomerPrice: number;
  netSalePriceExclVat: number;
  contributionPerServing: number;
  foodProductionCostRatio: number;
  contributionMarginPct: number;
  contributionPerBatch: number;
  priceDecision: "MEETS MARGIN" | "BELOW TARGET" | "PRICE NOT SET";
}

function computeRecipeMetrics(
  recipe: RecipeSheetData,
  ingredientsMap: Map<string, IngredientMasterItem>
): ComputedRecipeMetrics {
  const yieldCount = recipe.sellableBatchYield > 0 ? recipe.sellableBatchYield : 1;

  const enrichedLines = recipe.lines.map((line) => {
    const master = ingredientsMap.get(line.ingredientCode);
    if (!master) {
      return {
        id: line.id,
        ingredientCode: line.ingredientCode,
        ingredientName: line.ingredientCode ? "INVALID CODE" : "Select Ingredient",
        category: "-",
        unit: "-",
        netQtyPerBatch: line.netQtyPerBatch,
        unitCostBdt: 0,
        batchCostBdt: 0,
        costPerServing: 0,
        cutPrepSpec: line.cutPrepSpec,
        supplier: "-",
        allergenWarning: "",
        isValid: false,
      };
    }
    const unitCostBdt = computeUsableUnitCost(master);
    const batchCostBdt = line.netQtyPerBatch * unitCostBdt;
    const costPerServing = batchCostBdt / yieldCount;

    return {
      id: line.id,
      ingredientCode: line.ingredientCode,
      ingredientName: master.name,
      category: master.category,
      unit: master.baseUnit,
      netQtyPerBatch: line.netQtyPerBatch,
      unitCostBdt,
      batchCostBdt,
      costPerServing,
      cutPrepSpec: line.cutPrepSpec,
      supplier: master.preferredSupplier,
      allergenWarning: master.allergensNote || "0",
      isValid: true,
    };
  });

  const totalIngredientBatchCost = enrichedLines.reduce((sum, l) => sum + l.batchCostBdt, 0);
  const ingredientCostPerServing = totalIngredientBatchCost / yieldCount;

  const extraWastageAmount = totalIngredientBatchCost * recipe.extraBatchWastagePct;
  const totalPackagingCost = recipe.packagingPerServing * yieldCount;
  const totalBatchCost =
    totalIngredientBatchCost +
    extraWastageAmount +
    totalPackagingCost +
    recipe.directLabourPerBatch +
    recipe.utilitiesPerBatch +
    recipe.overheadPerBatch;

  const costPerServing = totalBatchCost / yieldCount;

  const marginDenom = 1 - recipe.desiredContributionMarginPct;
  const suggestedPriceExclVat = marginDenom > 0 ? costPerServing / marginDenom : 0;
  const suggestedCustomerPrice = suggestedPriceExclVat * (1 + recipe.vatTaxPct);

  const netSalePriceExclVat =
    recipe.actualMenuPrice > 0 ? recipe.actualMenuPrice / (1 + recipe.vatTaxPct) : 0;
  const contributionPerServing =
    netSalePriceExclVat > 0 ? netSalePriceExclVat - costPerServing : 0;
  const foodProductionCostRatio =
    netSalePriceExclVat > 0 ? costPerServing / netSalePriceExclVat : 0;
  const contributionMarginPct =
    netSalePriceExclVat > 0 ? contributionPerServing / netSalePriceExclVat : 0;
  const contributionPerBatch = contributionPerServing * yieldCount;

  let priceDecision: "MEETS MARGIN" | "BELOW TARGET" | "PRICE NOT SET" = "PRICE NOT SET";
  if (recipe.actualMenuPrice > 0) {
    // Allow tiny floating point tolerance
    priceDecision =
      contributionMarginPct + 1e-6 >= recipe.desiredContributionMarginPct
        ? "MEETS MARGIN"
        : "BELOW TARGET";
  }

  return {
    enrichedLines,
    totalIngredientBatchCost,
    ingredientCostPerServing,
    extraWastageAmount,
    totalPackagingCost,
    totalBatchCost,
    costPerServing,
    suggestedPriceExclVat,
    suggestedCustomerPrice,
    netSalePriceExclVat,
    contributionPerServing,
    foodProductionCostRatio,
    contributionMarginPct,
    contributionPerBatch,
    priceDecision,
  };
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function PosRecipeAndCostingPage() {
  const [activeTab, setActiveTab] = useState<RcTabId>("MENU_SUMMARY");
  const [ingredients, setIngredients] = useState<IngredientMasterItem[]>(INITIAL_INGREDIENTS);
  const [recipes, setRecipes] = useState<RecipeSheetData[]>(INITIAL_RECIPES);

  // Filters for Ingredient Master
  const [ingSearch, setIngSearch] = useState("");
  const [ingCategoryFilter, setIngCategoryFilter] = useState("All");

  // Modal for Adding New Ingredient
  const [isAddIngOpen, setIsAddIngOpen] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngCat, setNewIngCat] = useState("Dry groceries");
  const [newIngPack, setNewIngPack] = useState("1 kg bag");
  const [newIngNet, setNewIngNet] = useState("1000");
  const [newIngUnit, setNewIngUnit] = useState<"g" | "ml" | "pc">("g");
  const [newIngCost, setNewIngCost] = useState("100");
  const [newIngYield, setNewIngYield] = useState("100");
  const [newIngSupplier, setNewIngSupplier] = useState("");
  const [newIngAllergen, setNewIngAllergen] = useState("");

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  // Load persisted data from localStorage safely
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sIng = localStorage.getItem("erp_pos_rc_ingredients_v1");
      const sRcp = localStorage.getItem("erp_pos_rc_recipes_v1");
      queueMicrotask(() => {
        if (sIng) {
          const parsed = JSON.parse(sIng);
          if (Array.isArray(parsed) && parsed.length > 0) setIngredients(parsed);
        }
        if (sRcp) {
          const parsed = JSON.parse(sRcp);
          if (Array.isArray(parsed) && parsed.length > 0) setRecipes(parsed);
        }
      });
    } catch (e) {
      console.warn("Failed to load R&C state from localStorage:", e);
    }
  }, []);

  const saveIngredients = (next: IngredientMasterItem[]) => {
    setIngredients(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_rc_ingredients_v1", JSON.stringify(next));
      } catch (e) {
        console.warn("Could not save ingredients:", e);
      }
    }
  };

  const saveRecipes = (next: RecipeSheetData[]) => {
    setRecipes(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_rc_recipes_v1", JSON.stringify(next));
      } catch (e) {
        console.warn("Could not save recipes:", e);
      }
    }
  };

  const handleResetDefaults = () => {
    saveIngredients(INITIAL_INGREDIENTS);
    saveRecipes(INITIAL_RECIPES);
    showToast("Reset R&C Workbook to Marinozz Standard Template defaults");
  };

  // Map of Ingredient Code -> IngredientMasterItem
  const ingredientsMap = useMemo(() => {
    const map = new Map<string, IngredientMasterItem>();
    for (const item of ingredients) {
      map.set(item.code, item);
    }
    return map;
  }, [ingredients]);

  // All computed recipe summaries
  const computedRecipes = useMemo(() => {
    return recipes.map((r) => ({
      recipe: r,
      metrics: computeRecipeMetrics(r, ingredientsMap),
    }));
  }, [recipes, ingredientsMap]);

  // Distinct categories for Ingredient Master
  const ingredientCategories = useMemo(() => {
    const set = new Set<string>(ingredients.map((i) => i.category));
    return ["All", ...Array.from(set)];
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      if (ingCategoryFilter !== "All" && item.category !== ingCategoryFilter) return false;
      if (!ingSearch.trim()) return true;
      const q = ingSearch.toLowerCase();
      return (
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.preferredSupplier.toLowerCase().includes(q) ||
        item.allergensNote.toLowerCase().includes(q)
      );
    });
  }, [ingredients, ingCategoryFilter, ingSearch]);

  // Update a single ingredient field inline
  const handleUpdateIngredient = (
    code: string,
    field: keyof IngredientMasterItem,
    value: string | number
  ) => {
    const updated = ingredients.map((item) =>
      item.code === code
        ? {
            ...item,
            [field]: value,
            rateUpdated: new Date().toISOString().split("T")[0],
          }
        : item
    );
    saveIngredients(updated);
  };

  // Add new ingredient to Master
  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;
    const nextNum = ingredients.length + 1;
    const nextCode = `ING${String(nextNum).padStart(3, "0")}`;
    const newItem: IngredientMasterItem = {
      code: nextCode,
      name: newIngName.trim(),
      category: newIngCat,
      purchasePack: newIngPack.trim() || "1 kg pack",
      packNetContent: Math.max(0.01, Number(newIngNet) || 1000),
      baseUnit: newIngUnit,
      packCostBdt: Math.max(0, Number(newIngCost) || 0),
      usableYieldPct: Math.min(1, Math.max(0.05, (Number(newIngYield) || 100) / 100)),
      preferredSupplier: newIngSupplier.trim() || "General Supplier",
      allergensNote: newIngAllergen.trim(),
      rateUpdated: new Date().toISOString().split("T")[0],
    };
    saveIngredients([...ingredients, newItem]);
    setIsAddIngOpen(false);
    setNewIngName("");
    setNewIngSupplier("");
    setNewIngAllergen("");
    showToast(`Added ${nextCode} (${newItem.name}) to Ingredient Master`);
  };

  // Update a recipe sheet
  const updateRecipeByTabKey = (
    tabKey: "EXAMPLE_RESTAURANT" | "EXAMPLE_PANTOA" | "RECIPE_TEMPLATE",
    updater: (prev: RecipeSheetData) => RecipeSheetData
  ) => {
    const updated = recipes.map((r) => (r.tabKey === tabKey ? updater(r) : r));
    saveRecipes(updated);
  };

  // Export Menu Cost Summary + Ingredient Master to CSV
  const handleExportCsv = () => {
    const headers = [
      "Recipe ID",
      "Menu Product",
      "Business",
      "Category",
      "Batch Yield",
      "Yield Unit",
      "Ingredient Cost (BDT)",
      "Total Batch Cost (BDT)",
      "Cost / Unit (BDT)",
      "Suggested Price (BDT)",
      "Menu Price (BDT)",
      "Food Cost Ratio %",
      "Contribution / Unit (BDT)",
      "Contribution Margin %",
      "Price Decision",
    ];
    const rows = computedRecipes.map(({ recipe, metrics }) => [
      `"${recipe.recipeId}"`,
      `"${recipe.productName}"`,
      `"${recipe.brandBusiness}"`,
      `"${recipe.category}"`,
      recipe.sellableBatchYield,
      `"${recipe.yieldUnit}"`,
      metrics.totalIngredientBatchCost.toFixed(2),
      metrics.totalBatchCost.toFixed(2),
      metrics.costPerServing.toFixed(2),
      metrics.suggestedCustomerPrice.toFixed(2),
      recipe.actualMenuPrice.toFixed(2),
      (metrics.foodProductionCostRatio * 100).toFixed(2) + "%",
      metrics.contributionPerServing.toFixed(2),
      (metrics.contributionMarginPct * 100).toFixed(2) + "%",
      `"${metrics.priceDecision}"`,
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Marinozz_RC_Cost_Summary_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exported R&C Menu Cost Summary to Excel CSV");
  };

  // Render active recipe sheet helper
  const renderRecipeSheet = (
    tabKey: "EXAMPLE_RESTAURANT" | "EXAMPLE_PANTOA" | "RECIPE_TEMPLATE"
  ) => {
    const found = computedRecipes.find((c) => c.recipe.tabKey === tabKey);
    if (!found) return null;
    const { recipe, metrics } = found;

    const handleAddLine = () => {
      updateRecipeByTabKey(tabKey, (prev) => ({
        ...prev,
        lines: [
          ...prev.lines,
          {
            id: `line-${Date.now()}`,
            ingredientCode: ingredients[0]?.code || "ING001",
            netQtyPerBatch: 100,
            cutPrepSpec: "Standard prep",
          },
        ],
      }));
      showToast("Added ingredient line to recipe");
    };

    const handleRemoveLine = (lineId: string) => {
      updateRecipeByTabKey(tabKey, (prev) => ({
        ...prev,
        lines: prev.lines.filter((l) => l.id !== lineId),
      }));
    };

    const handleUpdateLine = (
      lineId: string,
      field: keyof RecipeIngredientLine,
      value: string | number
    ) => {
      updateRecipeByTabKey(tabKey, (prev) => ({
        ...prev,
        lines: prev.lines.map((l) =>
          l.id === lineId ? { ...l, [field]: value } : l
        ),
      }));
    };

    return (
      <div className="space-y-5">
        {/* Sheet Banner */}
        <div className="rounded-lg border border-blue-200 dark:border-slate-800 bg-gradient-to-r from-[#0f2942] to-[#1e3a5f] text-white p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  {recipe.recipeId}
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  STANDARD RECIPE & COST SHEET — {recipe.productName}
                </h2>
              </div>
              <p className="text-xs text-blue-200/90 mt-0.5">
                Marinozz Group | Approved recipe controls • ingredient traceability • batch costing • contribution-based menu pricing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                  metrics.priceDecision === "MEETS MARGIN"
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                    : metrics.priceDecision === "BELOW TARGET"
                    ? "bg-rose-500/20 text-rose-200 border-rose-400/40"
                    : "bg-amber-500/20 text-amber-200 border-amber-400/40"
                }`}
              >
                {metrics.priceDecision}
              </span>
            </div>
          </div>
        </div>

        {/* Colour Legend Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="size-3 rounded-xs bg-[#e8f4fd] border border-[#90caf9] inline-block" />
              INPUT CELLS = Light Blue (Editable)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="size-3 rounded-xs bg-[#e8f8f0] border border-[#81c784] inline-block" />
              AUTO FORMULAS = Light Green (Calculated)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="size-3 rounded-xs bg-[#fff8e1] border border-[#ffe082] inline-block" />
              WARNING / NOTES = Pale Amber
            </span>
          </div>
          <span className="text-slate-500">
            Linked live to <strong>Ingredient Master</strong>
          </span>
        </div>

        {/* 1. Recipe Header Metadata Grid (Rows 4 - 8 of Excel) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Recipe Identification & Batch Specification
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Recipe ID
              </label>
              <input
                type="text"
                value={recipe.recipeId}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, recipeId: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Product / Menu Name
              </label>
              <input
                type="text"
                value={recipe.productName}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, productName: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Brand / Business
              </label>
              <input
                type="text"
                value={recipe.brandBusiness}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, brandBusiness: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Category
              </label>
              <input
                type="text"
                value={recipe.category}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, category: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Version
              </label>
              <input
                type="text"
                value={recipe.version}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, version: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Sellable Batch Yield
              </label>
              <input
                type="number"
                min={1}
                value={recipe.sellableBatchYield}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    sellableBatchYield: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Yield Unit
              </label>
              <input
                type="text"
                value={recipe.yieldUnit}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({ ...r, yieldUnit: e.target.value }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Portion Description
              </label>
              <input
                type="text"
                value={recipe.portionDescription}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    portionDescription: e.target.value,
                  }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Serving Size ({recipe.sizeUnit})
              </label>
              <input
                type="number"
                value={recipe.servingSize}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    servingSize: Number(e.target.value) || 0,
                  }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Prep / Cook (min)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={recipe.prepTimeMin}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      prepTimeMin: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-8 w-1/2 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  title="Prep Time (min)"
                />
                <input
                  type="number"
                  value={recipe.cookTimeMin}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      cookTimeMin: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-8 w-1/2 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 dark:border-blue-800 px-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  title="Cook Time (min)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Recipe Ingredients Table (Rows 10 - 31 of Excel) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Recipe Ingredients & Batch Costing Table
              </h3>
              <p className="text-[11px] text-slate-500">
                Select Ingredient Code and enter Net Usable Quantity (g / ml / pc). Unit rates flow automatically from Ingredient Master.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLine}
              className="inline-flex items-center gap-1.5 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="size-3.5" />
              <span>Add Ingredient Line</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1e3a5f] text-white font-semibold">
                <tr>
                  <th className="p-2.5 text-center w-10">No.</th>
                  <th className="p-2.5 w-40">Ingredient Code</th>
                  <th className="p-2.5">Ingredient Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-center">Unit</th>
                  <th className="p-2.5 text-right w-28">Net Qty / Batch</th>
                  <th className="p-2.5 text-right">Unit Cost (BDT)</th>
                  <th className="p-2.5 text-right">Batch Cost (BDT)</th>
                  <th className="p-2.5 text-right">Cost / Serving</th>
                  <th className="p-2.5 min-w-[180px]">Cut / Prep Specification</th>
                  <th className="p-2.5">Supplier</th>
                  <th className="p-2.5">Allergen / Warning</th>
                  <th className="p-2.5 text-center w-10">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {metrics.enrichedLines.map((line, idx) => (
                  <tr
                    key={line.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-2 text-center font-medium text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="p-2">
                      <select
                        value={line.ingredientCode}
                        onChange={(e) =>
                          handleUpdateLine(line.id, "ingredientCode", e.target.value)
                        }
                        className="h-7 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 dark:border-blue-800 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.code} value={ing.code}>
                            {ing.code} — {ing.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 font-semibold text-slate-800 dark:text-slate-100">
                      {line.ingredientName}
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400">
                      {line.category}
                    </td>
                    <td className="p-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {line.unit}
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={line.netQtyPerBatch}
                        onChange={(e) =>
                          handleUpdateLine(
                            line.id,
                            "netQtyPerBatch",
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                        className="h-7 w-24 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 dark:border-blue-800 px-2 text-right font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-right font-mono bg-[#e8f8f0]/60 dark:bg-emerald-950/20 text-slate-700 dark:text-slate-300">
                      {line.unitCostBdt.toFixed(4)}
                    </td>
                    <td className="p-2 text-right font-mono font-bold bg-[#e8f8f0] dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300">
                      {line.batchCostBdt.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono bg-[#e8f8f0]/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400">
                      {line.costPerServing.toFixed(2)}
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={line.cutPrepSpec}
                        onChange={(e) =>
                          handleUpdateLine(line.id, "cutPrepSpec", e.target.value)
                        }
                        className="h-7 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 dark:border-blue-800 px-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-400">
                      {line.supplier}
                    </td>
                    <td className="p-2">
                      {line.allergenWarning && line.allergenWarning !== "0" ? (
                        <span className="inline-block rounded bg-[#fff8e1] dark:bg-amber-950/40 border border-[#ffe082] dark:border-amber-800 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                          {line.allergenWarning}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                        title="Remove line"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#d1e7dd] dark:bg-emerald-950/50 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-emerald-600">
                <tr>
                  <td colSpan={7} className="p-3 text-right uppercase tracking-wider text-xs">
                    TOTAL RECIPE INGREDIENTS
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-emerald-950 dark:text-emerald-200">
                    {metrics.totalIngredientBatchCost.toFixed(2)} BDT
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-emerald-900 dark:text-emerald-300">
                    {metrics.ingredientCostPerServing.toFixed(2)} BDT
                  </td>
                  <td colSpan={4} className="p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    Per {recipe.portionDescription} ({recipe.sellableBatchYield} {recipe.yieldUnit} / batch)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 3. Section A (Batch Production Cost) & Section B (Pricing & Contribution) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* SECTION A: BATCH PRODUCTION COST */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs flex flex-col justify-between">
            <div>
              <div className="bg-[#1e3a5f] text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider">
                A | BATCH PRODUCTION COST
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Ingredient Cost (BDT)
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {metrics.totalIngredientBatchCost.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Extra Batch Wastage %
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={Number((recipe.extraBatchWastagePct * 100).toFixed(2))}
                      onChange={(e) =>
                        updateRecipeByTabKey(tabKey, (r) => ({
                          ...r,
                          extraBatchWastagePct: Math.max(0, Number(e.target.value) || 0) / 100,
                        }))
                      }
                      className="h-7 w-24 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-500 font-semibold">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Extra Wastage Amount
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {metrics.extraWastageAmount.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Packaging / Serving (BDT)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={recipe.packagingPerServing}
                    onChange={(e) =>
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        packagingPerServing: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-7 w-28 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Total Packaging Cost ({recipe.sellableBatchYield} {recipe.yieldUnit})
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {metrics.totalPackagingCost.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Direct Labour / Batch (BDT)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="5"
                    value={recipe.directLabourPerBatch}
                    onChange={(e) =>
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        directLabourPerBatch: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-7 w-28 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Utilities / Batch (BDT)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="5"
                    value={recipe.utilitiesPerBatch}
                    onChange={(e) =>
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        utilitiesPerBatch: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-7 w-28 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Overhead Allocated / Batch (BDT)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="5"
                    value={recipe.overheadPerBatch}
                    onChange={(e) =>
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        overheadPerBatch: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-7 w-28 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="border-t-2 border-emerald-600 bg-[#d1e7dd] dark:bg-emerald-950/50 divide-y divide-emerald-200 dark:divide-emerald-900">
              <div className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                <span>TOTAL BATCH COST</span>
                <span className="font-mono text-sm">
                  {metrics.totalBatchCost.toFixed(2)} BDT
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs font-extrabold text-emerald-950 dark:text-emerald-100">
                <span>COST PER SELLABLE SERVING</span>
                <span className="font-mono text-base">
                  {metrics.costPerServing.toFixed(2)} BDT
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B: PRICING & CONTRIBUTION */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs flex flex-col justify-between">
            <div>
              <div className="bg-[#1e3a5f] text-white px-4 py-2.5 flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider">
                  B | PRICING & CONTRIBUTION
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    metrics.priceDecision === "MEETS MARGIN"
                      ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/40"
                      : "bg-rose-400/20 text-rose-200 border border-rose-400/40"
                  }`}
                >
                  {metrics.priceDecision}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Desired Contribution Margin %
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={95}
                      step="1"
                      value={Number((recipe.desiredContributionMarginPct * 100).toFixed(1))}
                      onChange={(e) =>
                        updateRecipeByTabKey(tabKey, (r) => ({
                          ...r,
                          desiredContributionMarginPct:
                            Math.min(95, Math.max(1, Number(e.target.value) || 50)) / 100,
                        }))
                      }
                      className="h-7 w-24 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-500 font-semibold">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Suggested Price (excl. VAT)
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {metrics.suggestedPriceExclVat.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    VAT / Applicable Sales Tax %
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step="0.5"
                      value={Number((recipe.vatTaxPct * 100).toFixed(1))}
                      onChange={(e) =>
                        updateRecipeByTabKey(tabKey, (r) => ({
                          ...r,
                          vatTaxPct: Math.max(0, Number(e.target.value) || 0) / 100,
                        }))
                      }
                      className="h-7 w-24 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-500 font-semibold">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Suggested Customer Price (incl. VAT)
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {metrics.suggestedCustomerPrice.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Actual Customer Menu Price (BDT)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={recipe.actualMenuPrice}
                    onChange={(e) =>
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        actualMenuPrice: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-7 w-28 rounded border-2 border-[#0d6efd] bg-[#e8f4fd] dark:bg-blue-950/50 px-2 text-right font-extrabold text-blue-900 dark:text-blue-200"
                  />
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Net Sale Price (excl. VAT)
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {metrics.netSalePriceExclVat.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Contribution / Serving
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {metrics.contributionPerServing.toFixed(2)} BDT
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 bg-[#e8f8f0]/60 dark:bg-emerald-950/15">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Food & Production Cost Ratio
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    {(metrics.foodProductionCostRatio * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-emerald-600 bg-[#d1e7dd] dark:bg-emerald-950/50 divide-y divide-emerald-200 dark:divide-emerald-900">
              <div className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                <span>CONTRIBUTION MARGIN %</span>
                <span className="font-mono text-sm">
                  {(metrics.contributionMarginPct * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-xs font-extrabold text-emerald-950 dark:text-emerald-100">
                <span>CONTRIBUTION / BATCH ({recipe.sellableBatchYield} {recipe.yieldUnit})</span>
                <span className="font-mono text-base">
                  {metrics.contributionPerBatch.toFixed(2)} BDT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Finance Check & Audit Advisories (Row 36 & Row 41 K-column notes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-[#ffe082] bg-[#fff8e1] dark:bg-amber-950/25 dark:border-amber-800/60 p-3 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold uppercase block mb-0.5">FINANCE CHECK</span>
            Ingredient yield % accounts for peel/trim losses. Use extra wastage only for separate production/batch losses. VAT applies only if required.
          </div>
          <div className="rounded border border-[#ffe082] bg-[#fff8e1] dark:bg-amber-950/25 dark:border-amber-800/60 p-3 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold uppercase block mb-0.5">MANAGEMENT NOTE</span>
            Contribution ≠ audited net profit. Allocate remaining uncounted expenses before final menu approval.
          </div>
        </div>

        {/* 4. Section C: Standard Preparation Method, Hygiene & Quality Control (Rows 45 - 63) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <div className="bg-[#1e3a5f] text-white px-4 py-2.5 font-bold text-xs uppercase tracking-wider">
            C | STANDARD PREPARATION METHOD, HYGIENE & QUALITY CONTROL
          </div>

          <div className="p-4 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mise en place / Pre-preparation
              </label>
              <input
                type="text"
                value={recipe.sop.miseEnPlace}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    sop: { ...r.sop, miseEnPlace: e.target.value },
                  }))
                }
                className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-3 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recipe.sop.steps.map((stepText, sIdx) => (
                <div key={sIdx} className="flex items-start gap-2">
                  <span className="inline-flex h-8 w-16 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    Step {sIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={stepText}
                    onChange={(e) => {
                      const nextSteps = [...recipe.sop.steps];
                      nextSteps[sIdx] = e.target.value;
                      updateRecipeByTabKey(tabKey, (r) => ({
                        ...r,
                        sop: { ...r.sop, steps: nextSteps },
                      }));
                    }}
                    className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Finish / Garnish / Portioning
                </label>
                <input
                  type="text"
                  value={recipe.sop.finishGarnishPortioning}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, finishGarnishPortioning: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Serving / Packing Standard
                </label>
                <input
                  type="text"
                  value={recipe.sop.servingPackingStandard}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, servingPackingStandard: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Storage & Holding Instruction
                </label>
                <input
                  type="text"
                  value={recipe.sop.storageHoldingInstruction}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, storageHoldingInstruction: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Food Safety / Critical QC
                </label>
                <input
                  type="text"
                  value={recipe.sop.foodSafetyCriticalQc}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, foodSafetyCriticalQc: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Allergens / Cross-contact Controls
                </label>
                <input
                  type="text"
                  value={recipe.sop.allergensCrossContact}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, allergensCrossContact: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#ffe082] bg-[#fff8e1] dark:bg-amber-950/30 px-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Equipment / Tools
                </label>
                <input
                  type="text"
                  value={recipe.sop.equipmentTools}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, equipmentTools: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chef Notes / Approval Comments
                </label>
                <input
                  type="text"
                  value={recipe.sop.chefNotesApproval}
                  onChange={(e) =>
                    updateRecipeByTabKey(tabKey, (r) => ({
                      ...r,
                      sop: { ...r.sop, chefNotesApproval: e.target.value },
                    }))
                  }
                  className="h-8 w-full rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/30 px-2.5 text-xs text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="rounded bg-[#fff8e1] dark:bg-amber-950/30 border border-[#ffe082] dark:border-amber-800/60 px-3.5 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
              <strong>RECIPE CONTROL:</strong> Change version after any ingredient, yield, process or portion change. Revalidate costs, sensory quality, allergen declaration and management approval.
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f8fafc] dark:bg-slate-950 p-4 sm:p-6 text-slate-800 dark:text-slate-100 space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="size-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Module Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ChefHat className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
                R&C — Recipe & Cost Control
              </h1>
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
                Marinozz & Pantoa Standard
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Operating-standard editable workbook • Ingredient Master, Batch Costing, Menu Engineering & Production SOP (BDT)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("INGREDIENT_MASTER");
              setIsAddIngOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer shadow-2xs"
          >
            <Plus className="size-3.5" />
            <span>Add Ingredient</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded border border-[#0d6efd] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#0d6efd] transition cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => typeof window !== "undefined" && window.print()}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Restore original Excel template values"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Workbook Sheet Navigation Tabs (Matching the 6 Excel Sheets) */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-lg px-3 pt-2 overflow-x-auto shadow-2xs">
        <div className="flex items-center gap-2 min-w-max">
          {[
            { id: "MENU_SUMMARY" as const, label: "Menu Cost Summary", icon: TrendingUp, badge: "Management" },
            { id: "INGREDIENT_MASTER" as const, label: "Ingredient Master", icon: Package, badge: `${ingredients.length} Items` },
            { id: "EXAMPLE_RESTAURANT" as const, label: "Example Restaurant (Fried Rice)", icon: UtensilsCrossed, badge: "MRZ-FD-001" },
            { id: "EXAMPLE_PANTOA" as const, label: "Example Pantoa (Butter Cookies)", icon: Cookie, badge: "PNT-BK-001" },
            { id: "RECIPE_TEMPLATE" as const, label: "Recipe Template (Pantoa Sweet)", icon: Sparkles, badge: "Editable" },
            { id: "READ_ME" as const, label: "Read Me & Formulas", icon: BookOpen, badge: "SOP Guide" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px transition-all cursor-pointer rounded-t ${
                  isActive
                    ? "border-[#0d6efd] text-[#0d6efd] bg-blue-50/50 dark:bg-blue-950/30"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                    isActive
                      ? "bg-[#0d6efd] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: MENU COST SUMMARY (Sheet 6: Menu Engineering | Cost Summary)
         ===================================================================== */}
      {activeTab === "MENU_SUMMARY" && (
        <div className="space-y-5">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Active Recipe Cards
              </p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {computedRecipes.length} Products
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                All recipes meet target margin
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Master Ingredients Linked
              </p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                {ingredients.length} SKUs
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Auto-updating usable yield & unit cost
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Avg Food & Production Cost %
              </p>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">
                {(
                  (computedRecipes.reduce(
                    (s, c) => s + c.metrics.foodProductionCostRatio,
                    0
                  ) /
                    computedRecipes.length) *
                  100
                ).toFixed(2)}
                %
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Includes ingredients, wastage, pack, labour & OH
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Avg Contribution Margin %
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {(
                  (computedRecipes.reduce(
                    (s, c) => s + c.metrics.contributionMarginPct,
                    0
                  ) /
                    computedRecipes.length) *
                  100
                ).toFixed(2)}
                %
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Above 55%–60% target benchmark
              </p>
            </div>
          </div>

          {/* Per-Recipe Cost & Pricing Monitor Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#0f2942] to-[#1e3a5f] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  MENU ENGINEERING | PER-RECIPE COST & PRICING MONITOR
                </h2>
                <p className="text-[11px] text-blue-200">
                  Management view • Live linked to recipe cards & Ingredient Master • Click any recipe to inspect or edit
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#e8f1fd] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Recipe ID</th>
                    <th className="p-3">Menu Product</th>
                    <th className="p-3">Business</th>
                    <th className="p-3 text-right">Batch Yield</th>
                    <th className="p-3 text-right">Ingredient Cost</th>
                    <th className="p-3 text-right">Batch Cost (BDT)</th>
                    <th className="p-3 text-right">Cost / Unit (BDT)</th>
                    <th className="p-3 text-right">Suggested Price</th>
                    <th className="p-3 text-right">Menu Price (BDT)</th>
                    <th className="p-3 text-right">Food Cost %</th>
                    <th className="p-3 text-right">Contribution / Unit</th>
                    <th className="p-3 text-right">Contribution %</th>
                    <th className="p-3 text-center">Price Decision</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {computedRecipes.map(({ recipe, metrics }) => (
                    <tr
                      key={recipe.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {recipe.recipeId}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {recipe.productName}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {recipe.brandBusiness}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {recipe.sellableBatchYield} {recipe.yieldUnit}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {metrics.totalIngredientBatchCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 bg-[#e8f8f0]/50 dark:bg-emerald-950/15">
                        {metrics.totalBatchCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 bg-[#e8f8f0] dark:bg-emerald-950/30">
                        {metrics.costPerServing.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {metrics.suggestedCustomerPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-blue-700 dark:text-blue-300 bg-[#e8f4fd]/60 dark:bg-blue-950/20">
                        {recipe.actualMenuPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-400 font-semibold">
                        {(metrics.foodProductionCostRatio * 100).toFixed(2)}%
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {metrics.contributionPerServing.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                        {(metrics.contributionMarginPct * 100).toFixed(2)}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            metrics.priceDecision === "MEETS MARGIN"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : metrics.priceDecision === "BELOW TARGET"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}
                        >
                          {metrics.priceDecision}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setActiveTab(recipe.tabKey)}
                          className="rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-2.5 py-1 text-[11px] font-semibold text-white transition cursor-pointer"
                        >
                          Open Card
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual Cost Structure Cards + Key Operating Guidelines */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Batch Cost Structure Breakdown */}
            <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Unit Economics & Margin Comparison
              </h3>
              <div className="space-y-4">
                {computedRecipes.map(({ recipe, metrics }) => {
                  const costPct = Math.min(
                    100,
                    Math.round(metrics.foodProductionCostRatio * 100)
                  );
                  const marginPct = Math.max(0, 100 - costPct);
                  return (
                    <div
                      key={recipe.id}
                      className="rounded border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-800/30 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {recipe.productName}
                          </span>{" "}
                          <span className="text-slate-400">({recipe.brandBusiness})</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          Menu Price: {recipe.actualMenuPrice.toFixed(2)} BDT | Cost:{" "}
                          {metrics.costPerServing.toFixed(2)} BDT | Margin:{" "}
                          {metrics.contributionPerServing.toFixed(2)} BDT
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                        <div
                          className="bg-amber-500 h-full transition-all"
                          style={{ width: `${costPct}%` }}
                          title={`Cost Ratio: ${costPct}%`}
                        />
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${marginPct}%` }}
                          title={`Contribution Margin: ${marginPct}%`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-full bg-amber-500" />
                          Food & Production Cost: {(metrics.foodProductionCostRatio * 100).toFixed(1)}%
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          Contribution Margin: {(metrics.contributionMarginPct * 100).toFixed(1)}% (Target:{" "}
                          {(recipe.desiredContributionMarginPct * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Operating Guidelines (Rows 12 - 22 of Sheet 6) */}
            <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">
                  KEY OPERATING GUIDELINES
                </h3>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  {KEY_OPERATING_GUIDELINES.map((g, idx) => (
                    <li
                      key={idx}
                      className="rounded border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5 leading-relaxed"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-[11px] text-blue-900 dark:text-blue-200">
                <strong>Pro Tip:</strong> Updating any supplier price or usable yield % in{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("INGREDIENT_MASTER")}
                  className="underline font-bold cursor-pointer"
                >
                  Ingredient Master
                </button>{" "}
                immediately recalculates all recipe cards and this summary table.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: INGREDIENT MASTER (Sheet 2: Ingredient Purchase Price Master)
         ===================================================================== */}
      {activeTab === "INGREDIENT_MASTER" && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#0f2942] to-[#1e3a5f] text-white p-4">
            <h2 className="text-base font-bold uppercase tracking-wide">
              INGREDIENT PURCHASE PRICE MASTER
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Blue cells are editable | Cost per usable g / ml / piece is calculated automatically | Always use matching units (g, ml, pc)
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              {ingredientCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setIngCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    ingCategoryFilter === cat
                      ? "bg-[#0d6efd] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search code, ingredient, supplier..."
                  value={ingSearch}
                  onChange={(e) => setIngSearch(e.target.value)}
                  className="h-8 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-xs focus:border-[#0d6efd] focus:outline-none"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={() => setIsAddIngOpen(true)}
                className="inline-flex items-center gap-1.5 rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-3.5 py-1.5 text-xs font-semibold text-white shrink-0 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>New Ingredient</span>
              </button>
            </div>
          </div>

          {/* Ingredient Master Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1e3a5f] text-white font-semibold">
                  <tr>
                    <th className="p-2.5">Ingredient Code</th>
                    <th className="p-2.5">Ingredient Name</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Purchase Pack</th>
                    <th className="p-2.5 text-right">Pack Net Content</th>
                    <th className="p-2.5 text-center">Base Unit</th>
                    <th className="p-2.5 text-right">Pack Cost (BDT)</th>
                    <th className="p-2.5 text-right">Usable Yield %</th>
                    <th className="p-2.5 text-right">Cost / Usable Unit</th>
                    <th className="p-2.5">Preferred Supplier</th>
                    <th className="p-2.5">Allergens / Note</th>
                    <th className="p-2.5 text-center">Rate Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredIngredients.map((item) => {
                    const usableUnitCost = computeUsableUnitCost(item);
                    return (
                      <tr
                        key={item.code}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.code}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </td>
                        <td className="p-2.5">
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.purchasePack}
                            onChange={(e) =>
                              handleUpdateIngredient(item.code, "purchasePack", e.target.value)
                            }
                            className="h-7 w-28 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-xs text-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            value={item.packNetContent}
                            onChange={(e) =>
                              handleUpdateIngredient(
                                item.code,
                                "packNetContent",
                                Math.max(0.01, Number(e.target.value) || 1)
                              )
                            }
                            className="h-7 w-20 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.baseUnit}
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={item.packCostBdt}
                            onChange={(e) =>
                              handleUpdateIngredient(
                                item.code,
                                "packCostBdt",
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="h-7 w-24 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-2 text-right font-mono font-bold text-blue-900 dark:text-blue-200"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min={5}
                              max={100}
                              step="1"
                              value={Number((item.usableYieldPct * 100).toFixed(1))}
                              onChange={(e) =>
                                handleUpdateIngredient(
                                  item.code,
                                  "usableYieldPct",
                                  Math.min(100, Math.max(5, Number(e.target.value) || 100)) / 100
                                )
                              }
                              className="h-7 w-16 rounded border border-[#90caf9] bg-[#e8f4fd] dark:bg-blue-950/40 px-1.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold bg-[#e8f8f0] dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300">
                          {usableUnitCost.toFixed(4)} / {item.baseUnit}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.preferredSupplier}
                            onChange={(e) =>
                              handleUpdateIngredient(
                                item.code,
                                "preferredSupplier",
                                e.target.value
                              )
                            }
                            className="h-7 w-32 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 text-xs text-slate-700 dark:text-slate-300"
                          />
                        </td>
                        <td className="p-2.5">
                          {item.allergensNote ? (
                            <span className="inline-block rounded bg-[#fff8e1] dark:bg-amber-950/40 border border-[#ffe082] dark:border-amber-800 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                              {item.allergensNote}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-[11px] text-slate-500">
                          {item.rateUpdated}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: EXAMPLE RESTAURANT (Sheet 4: MRZ-FD-001 Chicken Fried Rice)
         ===================================================================== */}
      {activeTab === "EXAMPLE_RESTAURANT" && renderRecipeSheet("EXAMPLE_RESTAURANT")}

      {/* =====================================================================
          TAB 4: EXAMPLE PANTOA (Sheet 5: PNT-BK-001 Butter Cookies)
         ===================================================================== */}
      {activeTab === "EXAMPLE_PANTOA" && renderRecipeSheet("EXAMPLE_PANTOA")}

      {/* =====================================================================
          TAB 5: RECIPE TEMPLATE (Sheet 3: Custom / Blank Template)
         ===================================================================== */}
      {activeTab === "RECIPE_TEMPLATE" && renderRecipeSheet("RECIPE_TEMPLATE")}

      {/* =====================================================================
          TAB 6: READ ME & FORMULAS (Sheet 1: Read Me)
         ===================================================================== */}
      {activeTab === "READ_ME" && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#0f2942] to-[#1e3a5f] text-white p-5">
            <h2 className="text-lg font-extrabold tracking-tight">
              MARINOZZ GROUP | RECIPE & COST CONTROL
            </h2>
            <p className="text-xs text-blue-200 mt-1">
              Operating-standard editable template • Suitable for Marinozz Restaurant and Pantoa • BDT
            </p>
          </div>

          {/* Workbook Instructions 01 - 06 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              WORKBOOK INSTRUCTIONS (01 – 06)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {WORKBOOK_INSTRUCTIONS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30 flex items-start gap-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0d6efd] text-white font-mono text-xs font-bold">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formulas & Control Points */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="bg-[#1e3a5f] text-white px-4 py-3 font-bold text-xs uppercase tracking-wider">
              FORMULAS & CONTROL POINTS
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {FORMULAS_CONTROL_POINTS.map((f, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {f.metric}
                  </span>
                  <code className="rounded bg-[#e8f8f0] dark:bg-emerald-950/40 border border-[#81c784] dark:border-emerald-800 px-3 py-1 font-mono text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    {f.formula}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer & Control Note */}
          <div className="rounded-lg border border-[#ffe082] bg-[#fff8e1] dark:bg-amber-950/30 dark:border-amber-800 p-4 text-xs text-amber-950 dark:text-amber-200 space-y-2">
            <div className="font-bold uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-700" />
              <span>INPUT CELLS = light blue | AUTO FORMULAS = light green | WARNING / NOTES = pale amber</span>
            </div>
            <p className="leading-relaxed">
              Cost & price are decision-support estimates, not statutory accounts. Ingredients, selling prices, VAT/tax treatment and allocations must be reviewed by management. Do not double-count trimming loss if already reflected in the Master usable-yield percentage. Recipe yield must reflect actual sellable portions after cooking.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD NEW INGREDIENT TO MASTER
         ===================================================================== */}
      {isAddIngOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-[#1e3a5f] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Add New Ingredient to Master
              </h3>
              <button
                type="button"
                onClick={() => setIsAddIngOpen(false)}
                className="text-white/70 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateIngredient} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ingredient Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basmati Rice / Pistachio Nuts"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newIngCat}
                    onChange={(e) => setNewIngCat(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs"
                  >
                    <option value="Dry groceries">Dry groceries</option>
                    <option value="Protein">Protein</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Sauces">Sauces</option>
                    <option value="Oils">Oils</option>
                    <option value="Seasoning">Seasoning</option>
                    <option value="Baking">Baking</option>
                    <option value="Flavour">Flavour</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Pack Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 kg bag"
                    value={newIngPack}
                    onChange={(e) => setNewIngPack(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pack Net Content *
                  </label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="any"
                    value={newIngNet}
                    onChange={(e) => setNewIngNet(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Base Unit *
                  </label>
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value as "g" | "ml" | "pc")}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs"
                  >
                    <option value="g">g (grams)</option>
                    <option value="ml">ml (millilitres)</option>
                    <option value="pc">pc (pieces)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pack Cost (BDT) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Usable Yield % *
                  </label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={100}
                    value={newIngYield}
                    onChange={(e) => setNewIngYield(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Supplier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dairy supplier"
                    value={newIngSupplier}
                    onChange={(e) => setNewIngSupplier(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Allergens / Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Milk, Egg, Wheat"
                    value={newIngAllergen}
                    onChange={(e) => setNewIngAllergen(e.target.value)}
                    className="h-9 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddIngOpen(false)}
                  className="rounded px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#0d6efd] hover:bg-[#0b5ed7] px-5 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
