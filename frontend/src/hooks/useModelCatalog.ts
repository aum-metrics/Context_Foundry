"use client";

import useSWR from "swr";

export interface CatalogModel {
    provider: string;
    displayName: string;
    productLabel: string;
    apiModelId: string;
    enabled: boolean;
    order: number;
    slot?: string;
}

const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load model catalog");
    return res.json();
};

export function useModelCatalog() {
    const { data, error, isLoading, mutate } = useSWR("/api/methods/model-catalog", fetcher);
    const rawModels: CatalogModel[] = (data?.models || [])
        .filter((model: CatalogModel) => model.enabled !== false)
        .filter((model: CatalogModel) => model.slot ? model.slot === "simulation" : true)
        .sort((a: CatalogModel, b: CatalogModel) => (a.order ?? 999) - (b.order ?? 999));

    // Deduplicate by provider so we only show one model per provider in the UI.
    const byProvider = new Map<string, CatalogModel>();
    rawModels.forEach((model) => {
        const key = model.provider?.toLowerCase() || model.displayName;
        if (!byProvider.has(key)) {
            byProvider.set(key, model);
        }
    });
    const models: CatalogModel[] = Array.from(byProvider.values());
    return {
        models,
        loading: isLoading,
        error,
        mutate,
    };
}
