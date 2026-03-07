"use client";

import useSWR from "swr";

export interface CatalogModel {
    provider: string;
    displayName: string;
    productLabel: string;
    apiModelId: string;
    enabled: boolean;
    order: number;
}

const fetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load model catalog");
    return res.json();
};

export function useModelCatalog() {
    const { data, error, isLoading, mutate } = useSWR("/api/methods/model-catalog", fetcher);
    const models: CatalogModel[] = (data?.models || []).filter((model: CatalogModel) => model.enabled !== false);
    return {
        models,
        loading: isLoading,
        error,
        mutate,
    };
}
