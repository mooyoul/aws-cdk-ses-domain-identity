import { waitUntilResourceRecordSetsChanged } from "@aws-sdk/client-route-53";
import { waitUntilIdentityExists } from "@aws-sdk/client-ses";

export const waitUntil = {
  resourceRecordSetsChanged: waitUntilResourceRecordSetsChanged,
  identityExists: waitUntilIdentityExists
}