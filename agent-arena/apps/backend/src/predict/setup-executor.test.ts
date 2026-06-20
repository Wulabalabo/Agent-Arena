import { describe, expect, it } from "bun:test";
import { extractCreatedManagerId } from "./setup-executor";

const predictPackageId = "0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138";

describe("extractCreatedManagerId", () => {
  it("extracts the manager id from the PredictManagerCreated event", () => {
    const managerId = "0xmanager";

    expect(extractCreatedManagerId({
      events: [
        {
          type: `${predictPackageId}::predict_manager::PredictManagerCreated`,
          parsedJson: {
            manager_id: managerId,
            owner: "0xowner"
          }
        }
      ],
      objectChanges: []
    } as never, predictPackageId)).toBe(managerId);
  });

  it("falls back to the created PredictManager object change", () => {
    const managerId = "0xmanager";

    expect(extractCreatedManagerId({
      events: [],
      objectChanges: [
        {
          type: "created",
          objectId: managerId,
          objectType: `${predictPackageId}::predict_manager::PredictManager`
        }
      ]
    } as never, predictPackageId)).toBe(managerId);
  });
});
