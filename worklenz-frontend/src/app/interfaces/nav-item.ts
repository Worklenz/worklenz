import {NavItemType} from "./nav-item-type";

export interface NavItem {
  label?: string;
  icon?: string;
  url?: string;
  type?: NavItemType;
}
