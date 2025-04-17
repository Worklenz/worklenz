import axios from "axios";
import jwt, {Secret} from "jsonwebtoken";
import {isLocalServer, isTestServer, log_error} from "./utils";
import {LOCAL_URL, PRODUCTION_SERVER_URL, UAT_SERVER_URL} from "./constants";

const local = isLocalServer() ? LOCAL_URL : PRODUCTION_SERVER_URL;
const serverUrl = isTestServer() ? UAT_SERVER_URL : local;
const jwtSecret: Secret = process.env.JWT_SECRET ?? "";

export async function generatePayLinkRequest(teamMemberData: any, plan: string, owner_id = "", user_id = "") {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/generate-pay-link`,
      { plan, quantity: teamMemberData.user_count, customer_email: teamMemberData.email, owner_id, user_id},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}

/**
 * update the users of the current subscription plan for the organization
 * @param subscription_id
 * @param quantity
 * @returns whether to continue adding the user to the organization
 */
export async function updateUsers(subscription_id: string, quantity: number) {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/update-subscription-quantity`,
      {quantity, subscription_id},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}

/**
 * update the users of the current subscription plan for the organization
 * @param subscription_id
 * @param quantity
 * @returns whether to continue adding the user to the organization
 */
export async function addModifier(subscription_id: string) {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/purchase-storage`,
      {subscription_id},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}

/**
 * update the users of the current subscription plan for the organization
 * @param subscription_id
 * @param quantity
 * @returns whether to continue adding the user to the organization
 */
export async function changePlan(plan_id: string, subscription_id: string) {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/change-plan`,
      {plan_id, subscription_id},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}

/**
 * update the users of the current subscription plan for the organization
 * @param subscription_id
 * @returns
 */
export async function cancelSubscription(subscription_id: string, user_id: string) {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/cancel-subscription`,
      {subscription_id, user_id},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}

/**
 * update the users of the current subscription plan for the organization
 * @param subscription_id
 * @returns
 */
export async function pauseOrResumeSubscription(subscription_id: string, user_id: string, pause: boolean) {
  try {
    const token = jwt.sign({serverId: "01"}, jwtSecret, {expiresIn: "1h"});

    const res = await axios.post(
      `${serverUrl}/paddle-secure/pause-subscription`,
      {subscription_id, user_id, pause},
      {headers: {Authorization: `Bearer ${token}`}});

    return res.data;
  } catch (error: any) {
    if (error?.isAxiosError) {
      log_error(error?.response?.data || error);
    } else {
      log_error(error);
    }
  }
}
