import {IClientViewModel} from "@interfaces/api-models/client-view-model";

export interface IClientsViewModel {
  total?: number;
  data?: IClientViewModel[];
}
