"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CheckCircle,
  FileSpreadsheet,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
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
  totalLabourUtilitiesOverhead: number;
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
  const totalLabourUtilitiesOverhead = recipe.directLabourPerBatch + recipe.utilitiesPerBatch + recipe.overheadPerBatch;
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
    totalLabourUtilitiesOverhead,
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

  // Safe load persisted data from localStorage
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
    } catch {
      // LocalStorage access restricted or invalid
    }
  }, []);

  const saveIngredients = (next: IngredientMasterItem[]) => {
    setIngredients(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_rc_ingredients_v1", JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const saveRecipes = (next: RecipeSheetData[]) => {
    setRecipes(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_pos_rc_recipes_v1", JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Restore all ingredients and recipes to default template values?")) {
      saveIngredients(INITIAL_INGREDIENTS);
      saveRecipes(INITIAL_RECIPES);
      showToast("Reset to default Marinozz & Pantoa standards");
    }
  };

  // Fast code -> ingredient map
  const ingredientsMap = useMemo(() => {
    const map = new Map<string, IngredientMasterItem>();
    ingredients.forEach((ing) => map.set(ing.code, ing));
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

  // Update single ingredient field
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

  // Add new ingredient
  const handleCreateIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;
    const nextNum = ingredients.length + 1;
    const nextCode = "ING" + String(nextNum).padStart(3, "0");
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
    showToast("Added " + nextCode + " (" + newItem.name + ") to Ingredient Master");
  };

  // Update recipe
  const updateRecipeByTabKey = (
    tabKey: "EXAMPLE_RESTAURANT" | "EXAMPLE_PANTOA" | "RECIPE_TEMPLATE",
    updater: (prev: RecipeSheetData) => RecipeSheetData
  ) => {
    const updated = recipes.map((r) => (r.tabKey === tabKey ? updater(r) : r));
    saveRecipes(updated);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Recipe ID",
      "Menu Product",
      "Brand / Business",
      "Batch Yield",
      "Yield Unit",
      "Total Ingredient Batch Cost",
      "Packaging Cost",
      "Labour & Utilities",
      "Total Batch Cost",
      "Cost Per Serving",
      "Target Margin %",
      "Suggested Price",
      "Actual Menu Price",
      "Food Cost %",
      "Gross Profit / Serving",
      "Gross Margin %",
      "Price Decision",
    ];

    const rows = computedRecipes.map(({ recipe, metrics }) => [
      recipe.recipeId,
      '"' + recipe.productName + '"',
      '"' + recipe.brandBusiness + '"',
      recipe.sellableBatchYield,
      recipe.yieldUnit,
      metrics.totalIngredientBatchCost.toFixed(2),
      metrics.totalPackagingCost.toFixed(2),
      metrics.totalLabourUtilitiesOverhead.toFixed(2),
      metrics.totalBatchCost.toFixed(2),
      metrics.costPerServing.toFixed(2),
      (recipe.desiredContributionMarginPct * 100).toFixed(1) + "%",
      metrics.suggestedCustomerPrice.toFixed(2),
      recipe.actualMenuPrice.toFixed(2),
      (metrics.foodProductionCostRatio * 100).toFixed(2) + "%",
      metrics.contributionPerServing.toFixed(2),
      (metrics.contributionMarginPct * 100).toFixed(2) + "%",
      '"' + metrics.priceDecision + '"',
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Marinozz_RC_Cost_Summary_" + new Date().toISOString().split("T")[0] + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exported R&C Menu Cost Summary to CSV");
  };

  // Recipe Sheet renderer
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
            id: "line-" + Date.now(),
            ingredientCode: ingredients[0]?.code || "ING001",
            netQtyPerBatch: 100,
            cutPrepSpec: "Standard prep",
          },
        ],
      }));
      showToast("Added ingredient line");
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
        lines: prev.lines.map((l) => (l.id === lineId ? { ...l, [field]: value } : l)),
      }));
    };

    return (
      <div className="space-y-4">
        {/* Header Card: Title, Code, Status & Key Metrics */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-800">
                {recipe.recipeId}
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {recipe.productName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {recipe.brandBusiness} &bull; {recipe.category} &bull; Batch Yield: {recipe.sellableBatchYield} {recipe.yieldUnit}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                  metrics.priceDecision === "MEETS MARGIN"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : metrics.priceDecision === "BELOW TARGET"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {metrics.priceDecision}
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Cost / Serving</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                {metrics.costPerServing.toFixed(2)} ৳
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Menu Price</span>
              <span className="font-mono font-bold text-blue-600 text-sm">
                {recipe.actualMenuPrice.toFixed(2)} ৳
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Food Cost %</span>
              <span className="font-mono font-bold text-amber-600 text-sm">
                {(metrics.foodProductionCostRatio * 100).toFixed(1)}%
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Gross Profit</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {metrics.contributionPerServing.toFixed(2)} ৳
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Margin %</span>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {(metrics.contributionMarginPct * 100).toFixed(1)}%
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 block text-[11px]">Target Margin</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 text-sm">
                {(recipe.desiredContributionMarginPct * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Recipe Specification Form (Editable) */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Recipe Specification & Parameters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Product Name</label>
              <input
                type="text"
                value={recipe.productName}
                onChange={(e) => updateRecipeByTabKey(tabKey, (r) => ({ ...r, productName: e.target.value }))}
                className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Batch Yield ({recipe.yieldUnit})</label>
              <input
                type="number"
                value={recipe.sellableBatchYield}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    sellableBatchYield: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Proposed Menu Price (BDT)</label>
              <input
                type="number"
                value={recipe.actualMenuPrice}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    actualMenuPrice: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full h-8 rounded border border-blue-400 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-950/30 px-2.5 font-mono font-bold text-xs text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Target Margin %</label>
              <input
                type="number"
                value={Number((recipe.desiredContributionMarginPct * 100).toFixed(0))}
                onChange={(e) =>
                  updateRecipeByTabKey(tabKey, (r) => ({
                    ...r,
                    desiredContributionMarginPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100,
                  }))
                }
                className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Recipe Ingredients Table (POS Styled) */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Recipe Ingredients & Batch Quantities
            </h3>
            <button
              type="button"
              onClick={handleAddLine}
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Ingredient</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-12 text-center">SL</th>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Ingredient Name</th>
                  <th className="p-2.5 text-right">Net Qty / Batch</th>
                  <th className="p-2.5 text-center">Unit</th>
                  <th className="p-2.5 text-right">Yield %</th>
                  <th className="p-2.5 text-right">Cost / Unit</th>
                  <th className="p-2.5 text-right">Line Cost (BDT)</th>
                  <th className="p-2.5 text-right">% of Total</th>
                  <th className="p-2.5">Preparation Spec</th>
                  <th className="p-2.5 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.enrichedLines.map((line, idx) => {
                  const master = ingredientsMap.get(line.ingredientCode);
                  const yieldPct = master ? (master.usableYieldPct * 100).toFixed(0) : "100";
                  const pctCost =
                    metrics.totalIngredientBatchCost > 0
                      ? ((line.batchCostBdt / metrics.totalIngredientBatchCost) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-mono font-bold text-blue-600">{line.ingredientCode}</td>
                      <td className="p-2.5">
                        <select
                          value={line.ingredientCode}
                          onChange={(e) => handleUpdateLine(line.id, "ingredientCode", e.target.value)}
                          className="h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-slate-100 font-medium"
                        >
                          {ingredients.map((ing) => (
                            <option key={ing.code} value={ing.code}>
                              {ing.code} &bull; {ing.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.netQtyPerBatch}
                          onChange={(e) =>
                            handleUpdateLine(
                              line.id,
                              "netQtyPerBatch",
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="h-7 w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-right font-mono font-semibold text-xs text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-500">{line.unit}</td>
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        {yieldPct}%
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-600">
                        {line.unitCostBdt.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {line.batchCostBdt.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-blue-600">{pctCost}%</td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={line.cutPrepSpec}
                          onChange={(e) => handleUpdateLine(line.id, "cutPrepSpec", e.target.value)}
                          className="h-7 w-48 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-300"
                          placeholder="e.g. Diced, fine cut"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-rose-500 hover:text-rose-700 transition"
                          title="Remove item"
                        >
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <td colSpan={7} className="p-2.5 text-right text-slate-700 dark:text-slate-300 uppercase">
                    Total Ingredients Batch Cost:
                  </td>
                  <td className="p-2.5 text-right font-mono text-blue-600 font-extrabold text-sm">
                    {metrics.totalIngredientBatchCost.toFixed(2)} ৳
                  </td>
                  <td colSpan={3} className="p-2.5 text-slate-500 text-[11px]">
                    Net Yield: {recipe.sellableBatchYield} {recipe.yieldUnit}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Production SOP & QC Guidelines (Collapsible / Clean) */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Standard Preparation Steps &amp; Quality Control (SOP)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {recipe.sop.steps.map((step, sIdx) => (
              <div
                key={sIdx}
                className="flex items-start gap-2.5 p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold">
                  {sIdx + 1}
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">CCP & Food Safety</span>
              <p className="text-slate-600 dark:text-slate-400">{recipe.sop.foodSafetyCriticalQc}</p>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Allergens / Cross Contact</span>
              <p className="text-amber-700 dark:text-amber-400 font-medium">{recipe.sop.allergensCrossContact}</p>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Storage & Shelf Life</span>
              <p className="text-slate-600 dark:text-slate-400">{recipe.sop.storageHoldingInstruction}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950 p-4 sm:p-6 space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2.5 shadow-xl border border-slate-700 text-xs font-semibold">
          <CheckCircle className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Recipe & Cost Control (R&C)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            BridgeOne POS &bull; Marinozz & Pantoa Standard Costing & Production Sheets
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded border border-[#0d6efd] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-[#0d6efd] uppercase transition-colors cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>EXCEL CSV</span>
          </button>
          <button
            type="button"
            onClick={() => typeof window !== "undefined" && window.print()}
            className="flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 uppercase transition-colors cursor-pointer shadow-2xs"
          >
            <Printer className="size-3.5" />
            <span>PRINT</span>
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition cursor-pointer"
            title="Reset defaults"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. Top Tabs Navigation (Matching Setup & Reports style) */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex items-center gap-8 -mb-px text-xs font-bold tracking-wide min-w-max">
          {[
            { id: "MENU_SUMMARY" as const, label: "MENU COST SUMMARY" },
            { id: "INGREDIENT_MASTER" as const, label: "INGREDIENT MASTER" },
            { id: "EXAMPLE_RESTAURANT" as const, label: "CHICKEN FRIED RICE (REST.)" },
            { id: "EXAMPLE_PANTOA" as const, label: "BUTTER COOKIES (PANTOA)" },
            { id: "RECIPE_TEMPLATE" as const, label: "CUSTOM RECIPE BUILDER" },
            { id: "READ_ME" as const, label: "READ ME & FORMULAS" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 transition border-b-2 whitespace-nowrap cursor-pointer uppercase ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* =====================================================================
          TAB 1: MENU COST SUMMARY
         ===================================================================== */}
      {activeTab === "MENU_SUMMARY" && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Total Recipes</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                {computedRecipes.length}
              </span>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Master Ingredients</span>
              <span className="font-bold text-blue-600 text-lg">
                {ingredients.length} Items
              </span>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Avg Food Cost %</span>
              <span className="font-mono font-bold text-amber-600 text-lg">
                {(
                  (computedRecipes.reduce((s, c) => s + c.metrics.foodProductionCostRatio, 0) /
                    computedRecipes.length) *
                  100
                ).toFixed(1)}%
              </span>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Avg Gross Margin %</span>
              <span className="font-mono font-bold text-emerald-600 text-lg">
                {(
                  (computedRecipes.reduce((s, c) => s + c.metrics.contributionMarginPct, 0) /
                    computedRecipes.length) *
                  100
                ).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Clean POS Styled Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Recipe ID</th>
                  <th className="p-3 font-semibold">Menu Product</th>
                  <th className="p-3 font-semibold">Business</th>
                  <th className="p-3 font-semibold text-right">Batch Yield</th>
                  <th className="p-3 font-semibold text-right">Batch Cost (BDT)</th>
                  <th className="p-3 font-semibold text-right">Cost / Unit (BDT)</th>
                  <th className="p-3 font-semibold text-right">Menu Price (BDT)</th>
                  <th className="p-3 font-semibold text-right">Food Cost %</th>
                  <th className="p-3 font-semibold text-right">Profit / Unit</th>
                  <th className="p-3 font-semibold text-right">Margin %</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {computedRecipes.map(({ recipe, metrics }) => (
                  <tr key={recipe.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-blue-600">{recipe.recipeId}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{recipe.productName}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{recipe.brandBusiness}</td>
                    <td className="p-3 text-right font-medium">
                      {recipe.sellableBatchYield} {recipe.yieldUnit}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {metrics.totalBatchCost.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {metrics.costPerServing.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-600">
                      {recipe.actualMenuPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-amber-600 font-semibold">
                      {(metrics.foodProductionCostRatio * 100).toFixed(1)}%
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      {metrics.contributionPerServing.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-emerald-600">
                      {(metrics.contributionMarginPct * 100).toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          metrics.priceDecision === "MEETS MARGIN"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {metrics.priceDecision}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveTab(recipe.tabKey)}
                        className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition cursor-pointer"
                      >
                        View Card
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Operating Guidelines Card */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Key Operating Guidelines (Marinozz & Pantoa Standards)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              {KEY_OPERATING_GUIDELINES.map((g, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="font-bold text-blue-600">&bull;</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: INGREDIENT MASTER
         ===================================================================== */}
      {activeTab === "INGREDIENT_MASTER" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {ingredientCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setIngCategoryFilter(cat)}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    ingCategoryFilter === cat
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Search ingredient..."
                  value={ingSearch}
                  onChange={(e) => setIngSearch(e.target.value)}
                  className="w-full h-9 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="size-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={() => setIsAddIngOpen(true)}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="size-4" />
                <span>Create Ingredient</span>
              </button>
            </div>
          </div>

          {/* Clean Ingredient Table */}
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Code</th>
                  <th className="p-3 font-semibold">Ingredient Name</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Purchase Pack</th>
                  <th className="p-3 font-semibold text-right">Pack Net</th>
                  <th className="p-3 font-semibold text-center">Unit</th>
                  <th className="p-3 font-semibold text-right">Pack Cost (BDT)</th>
                  <th className="p-3 font-semibold text-right">Yield %</th>
                  <th className="p-3 font-semibold text-right">Cost / Usable Unit</th>
                  <th className="p-3 font-semibold">Preferred Supplier</th>
                  <th className="p-3 font-semibold">Allergens / Note</th>
                  <th className="p-3 font-semibold text-center">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIngredients.map((item) => {
                  const usableUnitCost = computeUsableUnitCost(item);
                  return (
                    <tr key={item.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-blue-600">{item.code}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{item.category}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{item.purchasePack}</td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {item.packNetContent}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{item.baseUnit}</td>
                      <td className="p-3 text-right font-mono">
                        <input
                          type="number"
                          value={item.packCostBdt}
                          onChange={(e) =>
                            handleUpdateIngredient(item.code, "packCostBdt", Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-20 h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-right font-mono font-semibold text-xs text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="p-3 text-right font-mono">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={5}
                            max={100}
                            value={Number((item.usableYieldPct * 100).toFixed(0))}
                            onChange={(e) =>
                              handleUpdateIngredient(
                                item.code,
                                "usableYieldPct",
                                Math.min(100, Math.max(5, Number(e.target.value) || 100)) / 100
                              )
                            }
                            className="w-14 h-7 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-right font-mono font-semibold text-xs text-slate-900 dark:text-slate-100"
                          />
                          <span className="text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {usableUnitCost.toFixed(4)} / {item.baseUnit}
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{item.preferredSupplier}</td>
                      <td className="p-3">
                        {item.allergensNote ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {item.allergensNote}
                          </span>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-400 text-[11px]">{item.rateUpdated}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: EXAMPLE RESTAURANT (Fried Rice)
         ===================================================================== */}
      {activeTab === "EXAMPLE_RESTAURANT" && renderRecipeSheet("EXAMPLE_RESTAURANT")}

      {/* =====================================================================
          TAB 4: EXAMPLE PANTOA (Butter Cookies)
         ===================================================================== */}
      {activeTab === "EXAMPLE_PANTOA" && renderRecipeSheet("EXAMPLE_PANTOA")}

      {/* =====================================================================
          TAB 5: RECIPE TEMPLATE
         ===================================================================== */}
      {activeTab === "RECIPE_TEMPLATE" && renderRecipeSheet("RECIPE_TEMPLATE")}

      {/* =====================================================================
          TAB 6: READ ME & FORMULAS
         ===================================================================== */}
      {activeTab === "READ_ME" && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Workbook Operating Instructions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {WORKBOOK_INSTRUCTIONS.map((item) => (
                <div
                  key={item.step}
                  className="rounded border border-slate-100 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/40"
                >
                  <span className="font-mono text-xs font-bold text-blue-600 block mb-1">
                    Step {item.step}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Key Control Metric</th>
                  <th className="p-3 font-semibold">Mathematical Formula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {FORMULAS_CONTROL_POINTS.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{f.metric}</td>
                    <td className="p-3 font-mono text-blue-600 font-medium">{f.formula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create New Ingredient */}
      {isAddIngOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Create New Ingredient
              </h3>
              <button
                type="button"
                onClick={() => setIsAddIngOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Ingredient Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boneless Chicken Breast"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={newIngCat}
                    onChange={(e) => setNewIngCat(e.target.value)}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  >
                    <option value="Dry groceries">Dry groceries</option>
                    <option value="Meat & poultry">Meat & poultry</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Base Unit</label>
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value as "g" | "ml" | "pc")}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-mono"
                  >
                    <option value="g">grams (g)</option>
                    <option value="ml">millilitres (ml)</option>
                    <option value="pc">pieces (pc)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Purchase Pack</label>
                  <input
                    type="text"
                    value={newIngPack}
                    onChange={(e) => setNewIngPack(e.target.value)}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Pack Net Qty</label>
                  <input
                    type="number"
                    value={newIngNet}
                    onChange={(e) => setNewIngNet(e.target.value)}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Pack Cost (BDT)</label>
                  <input
                    type="number"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(e.target.value)}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Usable Yield %</label>
                  <input
                    type="number"
                    value={newIngYield}
                    onChange={(e) => setNewIngYield(e.target.value)}
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newIngSupplier}
                    onChange={(e) => setNewIngSupplier(e.target.value)}
                    placeholder="Supplier name"
                    className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Allergens / Note</label>
                <input
                  type="text"
                  value={newIngAllergen}
                  onChange={(e) => setNewIngAllergen(e.target.value)}
                  placeholder="e.g. Gluten, Egg, Soy"
                  className="w-full h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddIngOpen(false)}
                  className="h-8 px-4 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
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
