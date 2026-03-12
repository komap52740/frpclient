import { appointmentsApi } from "../../../../api/client";

export function createAppointment(payload) {
  return appointmentsApi.create(payload);
}
