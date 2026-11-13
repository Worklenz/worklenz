export type StatusCategoryOrder = string[];

export interface IStatusCategoryOrderResponse {
  category_order: StatusCategoryOrder;
}

export interface IStatusCategoryOrderChangedEvent {
  project_id: string;
  category_order: StatusCategoryOrder;
}
