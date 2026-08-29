import axios from "axios";
import jwt, {Secret} from "jsonwebtoken";
import {isLocalServer, isTestServer, log_error} from "../../shared/utils";
import {LOCAL_URL, PRODUCTION_SERVER_URL, UAT_SERVER_URL} from "../../shared/constants";

const local = isLocalServer() ? LOCAL_URL : PRODUCTION_SERVER_URL;
const serverUrl = isTestServer() ? UAT_SERVER_URL : local;
const jwtSecret: Secret = process.env.JWT_SECRET ?? "";

async function post(endpoint: string, body: Record<string, unknown>) {
  const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});
  try {
    const res = await axios.post(
      `${serverUrl}/paddle-secure/${endpoint}`,
      body,
      {headers: {Authorization: `Bearer ${token}`}});
    return res.data;
  } catch (error: any) {
    log_error(error?.isAxiosError ? (error.response?.data ?? error) : error);
    throw error;
  }
}

export async function generatePayLinkRequest(teamMemberData: any, plan: string, owner_id = "", user_id = "") {
  return post("generate-pay-link", {
    plan,
    quantity: teamMemberData.user_count,
    customer_email: teamMemberData.email,
    owner_id,
    user_id,
  });
}

export async function updateUsers(subscription_id: string, quantity: number) {
  return post("update-subscription-quantity", {quantity, subscription_id});
}

export async function addModifier(subscription_id: string) {
  return post("purchase-storage", {subscription_id});
}

export async function changePlan(plan_id: string, subscription_id: string) {
  return post("change-plan", {plan_id, subscription_id});
}

export async function cancelSubscription(subscription_id: string, user_id: string) {
  return post("cancel-subscription", {subscription_id, user_id});
}

export async function pauseOrResumeSubscription(subscription_id: string, user_id: string, pause: boolean) {
  return post("pause-subscription", {subscription_id, user_id, pause});
}
