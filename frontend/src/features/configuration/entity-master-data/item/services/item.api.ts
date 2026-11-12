import { apiRequest } from "@/lib/api/client";
import type {
  CategoryOption,
  CreateCategoryInput,
  CreateNamedOptionInput,
  ItemDto,
  ItemFilterOptions,
  ItemFilters,
  ItemFormOptions,
  ItemImportResult,
  ItemInput,
  ItemList,
  OpeningStockInput,
  OpeningStockOptions,
  OpeningStockResult,
  UpdateCategoryInput,
} from "../schemas/item.schema";

const BASE = "/api/configuration/entity-master-data/items";

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const itemApi = {
  list: (params: ItemFilters & { page: number; pageSize: number }) => {
    const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && key !== "pageSize" && value) query.set(key, String(value));
    }
    return apiRequest<ItemList>(`${BASE}?${query}`);
  },
  filterOptions: () => apiRequest<ItemFilterOptions>(`${BASE}/filter-options`),
  get: (id: string) => apiRequest<ItemDto>(`${BASE}/${id}`),
  create: (input: ItemInput) => apiRequest<ItemDto>(BASE, json("POST", input)),
  update: (id: string, input: ItemInput) => apiRequest<ItemDto>(`${BASE}/${id}`, json("PUT", input)),
  setActive: (id: string, isActive: boolean) =>
    apiRequest<{ id: string; isActive: boolean }>(`${BASE}/${id}/status`, json("PATCH", { isActive })),
  formOptions: () => apiRequest<ItemFormOptions>(`${BASE}/form-options`),

  addCategory: (input: CreateCategoryInput) => apiRequest<CategoryOption>(`${BASE}/categories`, json("POST", input)),
  updateCategory: (id: string, input: UpdateCategoryInput) =>
    apiRequest<{ id: string; name: string; description: string | null }>(`${BASE}/categories/${id}`, json("PUT", input)),
  deleteCategory: (id: string) => apiRequest<void>(`${BASE}/categories/${id}`, { method: "DELETE" }),
  addDivision: (input: CreateNamedOptionInput) =>
    apiRequest<{ id: string; name: string; businessUnitId: string }>(`${BASE}/divisions`, json("POST", input)),
  addUom: (input: CreateNamedOptionInput) => apiRequest<{ name: string; businessUnitId: string }>(`${BASE}/uoms`, json("POST", input)),

  openingStockOptions: () => apiRequest<OpeningStockOptions>(`${BASE}/opening-stock/options`),
  createOpeningStock: (input: OpeningStockInput) => apiRequest<OpeningStockResult>(`${BASE}/opening-stock`, json("POST", input)),

  templateUrl: `${BASE}/import/template`,
  importFile: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return apiRequest<ItemImportResult>(`${BASE}/import`, { method: "POST", body: form });
  },
};
