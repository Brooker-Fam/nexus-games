import { toNodeHandler } from "better-auth/node";
import { auth } from "../../lib/auth.js";

export default toNodeHandler(auth.handler);

export const config = {
  api: {
    bodyParser: false,
  },
};
