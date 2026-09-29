import {
  type CreatorCandidate,
  CreatorCandidateSchema,
  type FollowedCreator,
  FollowedCreatorSchema,
  FollowedCreatorsResponseSchema,
} from "@finifeed/shared";
import { apiRequest, apiRequestNoContent } from "./client";

export async function fetchFollowedCreators(): Promise<FollowedCreator[]> {
  return (await apiRequest("/creators", FollowedCreatorsResponseSchema)).creators;
}

/** Looks up a YouTube @handle or channel URL. Does not follow. */
export function resolveYouTubeCreator(input: string): Promise<CreatorCandidate> {
  return apiRequest("/creators/resolve", CreatorCandidateSchema, {
    method: "POST",
    body: { sourceType: "YOUTUBE", input },
  });
}

export function followCreator(creatorId: string): Promise<FollowedCreator> {
  return apiRequest("/subscriptions", FollowedCreatorSchema, { method: "POST", body: { creatorId } });
}

export function unfollowCreator(subscriptionId: string): Promise<void> {
  return apiRequestNoContent(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}
