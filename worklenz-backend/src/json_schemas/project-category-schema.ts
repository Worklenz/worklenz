export default {
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 2,
      maxLength: 20,
      message: "Invalid category name"
    },
    color_code: {type: ["string", "null"]}
  },
  required: ["name"]
};
