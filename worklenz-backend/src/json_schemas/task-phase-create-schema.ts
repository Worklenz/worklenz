export default {
  type: "object",
  properties: {
    name: {
      type: "string",
      message: "Invalid name",
      minLength: 2,
      maxLength: 50
    }
  },
  required: ["name"]
};
