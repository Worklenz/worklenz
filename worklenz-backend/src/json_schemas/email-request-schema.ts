export default {
  type: "object",
  properties: {
    to: {
      type: "array",
      items: {type: "string"},
      minItems: 1 // Optional field, at least 1 item required
    },
    subject: {type: "string"},
    html: {type: "string"}
  },
  required: ["to", "subject", "html"] // subject and html fields are required
};
