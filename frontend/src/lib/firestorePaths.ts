import app from "./firebase";
import { getFirestore, collection, doc } from "firebase/firestore";

export const db = getFirestore(app);

// Workspaces
export const workspacesRef = collection(db, "workspaces");
export const getWorkspaceDoc = (workspaceId: string) => doc(db, "workspaces", workspaceId);

// LCRS Metrics tracking
export const lcrsMetricsRef = collection(db, "lcrs_metrics");

// Generated JSON-LD schemas
export const schemasRef = collection(db, "schemas");

// Agent Manifests (llms.txt content)
export const manifestsRef = collection(db, "manifests");
