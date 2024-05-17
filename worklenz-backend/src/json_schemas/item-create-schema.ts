export default {
  type: "object",
  properties: {
    name: {type: "string", message: "Invalid Name"},
    sku: {type: "string", message: "Invalid SKU"},
    stock_amount: {type: "number", message: "Invalid Stock Amount"},
    image: {type: "string", message: "Invalid Image"},
    price: {type: "number", message: "Invalid Price"},
    value: {type: "number", message: "Invalid Value"},
    active: {type: "boolean", message: "Invalid type of Active"},
    category_id: {type: "string", message: "Invalid Category"}
  },
  required: ["name", "sku", "stock_amount", "image", "price", "value", "active", "category_id"],
};
