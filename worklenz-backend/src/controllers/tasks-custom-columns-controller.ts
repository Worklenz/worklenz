import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TasksCustomColumnsController extends WorklenzControllerBase {

  // Columns

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  // Options

  @HandleExceptions()
  public static async createOption(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async getOption(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async updateOption(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async deleteOption(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return res.status(200).send(new ServerResponse(true, []));
  }
}
