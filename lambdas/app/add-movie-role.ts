import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = parseJsonObject(event);
  if (isResponse(body)) return body;


  // Validate the request body, if movieId is not a number returns a 400 response with an error message, same concept for all.
  if (typeof body.movieId !== "number" ||
    typeof body.actorId !== "number" ||
    typeof body.roleName !== "string" ||
    typeof body.roleDescription !== "string"
  ) {
    return response(400, {
      message:
        "Invalid request body. Required fields: movieId (number), actorId (number), roleName (string), roleDescription (string)",
    });
  }

  const role: Role = {
    movieId: body.movieId as number,
    actorId: body.actorId as number,
    roleName: body.roleName as string,
    roleDescription: body.roleDescription as string,
  };

  try {
    //Add role if its IDs are valid
    const movieResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: movieKey(role.movieId), SK: movieKey(role.movieId) },
      })
    );
    if (!movieResult.Item) {
      return response(404, { message: `Movie ${role.movieId} not found` });
    }

    const actorResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: actorKey(role.actorId), SK: actorKey(role.actorId) },
      })
    );
    if (!actorResult.Item) {
      return response(404, { message: `Actor ${role.actorId} not found` });
    }

    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: movieKey(role.movieId),
          SK: actorKey(role.actorId),
          ...role,
        },
      })
    );

    return response(201, { message: "Role added", data: role });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error"
    });
  }
};
