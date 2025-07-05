import { initGraph } from '../graph';

type UnpersistedChatbotResponse = {
  input: string;
  rephrasedQuestion: string;
  output: string;
  cypher: string | undefined;
};

export type ChatbotResponse = UnpersistedChatbotResponse & {
  id: string;
};

// tag::clear[]
export async function clearHistory(sessionId: string): Promise<void> {
  const graph = await initGraph();
  await graph.query(
    `
    MATCH (s:Session {id: $sessionId})-[:HAS_RESPONSE]->(r)
    DETACH DELETE r
  `,
    { sessionId },
    'WRITE'
  );
}
// end::clear[]

// tag::get[]
export async function getHistory(
  sessionId: string,
  limit: number = 5
): Promise<ChatbotResponse[]> {
  const graph = await initGraph();
  const res = await graph.query<ChatbotResponse>(
    `
      MATCH (:Session {id: $sessionId})-[:LAST_RESPONSE]->(last)
      MATCH path = (start)-[:NEXT*0..${limit}]->(last)
      WHERE length(path) = 5 OR NOT EXISTS { ()-[:NEXT]->(start) }
      UNWIND nodes(path) AS response
      RETURN response.id AS id,
        response.input AS input,
        response.rephrasedQuestion AS rephrasedQuestion,
        response.output AS output,
        response.cypher AS cypher,
        response.createdAt AS createdAt,
        [ (response)-[:CONTEXT]->(n) | elementId(n) ] AS context
    `,
    { sessionId },
    'READ'
  );

  return res as ChatbotResponse[];
}
// end::get[]

// tag::save[]
/**
 * Save a question and response to the database
 *
 * @param {string} sessionId
 * @param {string} source
 * @param {string} input
 * @param {string} rephrasedQuestion
 * @param {string} output
 * @param {string[]} ids
 * @param {string | null} cypher
 * @returns {string}  The ID of the Message node
 */
export async function saveHistory(
  sessionId: string,
  source: string,
  input: string,
  rephrasedQuestion: string,
  output: string,
  ids: string[],
  cypher: string | null = null
): Promise<string> {
  // TODO: Execute the Cypher statement from /cypher/save-response.cypher in a write transaction
  const graph = await initGraph();
  const res = await graph.query<{ id: string }>(
    `
  // Ensure the session node exists (create if not)
  MERGE (session:Session { id: $sessionId }) // (1)

  // Create a new response node with all relevant properties
  CREATE (response:Response {
    id: randomUuid(),
    createdAt: datetime(),
    source: $source,
    input: $input,
    output: $output,
    rephrasedQuestion: $rephrasedQuestion,
    cypher: $cypher,
    ids: $ids
  })
  // Link the session to the new response
  CREATE (session)-[:HAS_RESPONSE]->(response)

  // Carry session and response into the next part of the query.
  WITH session, response

  // Subquery to update response chain
  CALL {
    WITH session, response

    // Remove the existing LAST_RESPONSE relationship, if any
    MATCH (session)-[lrel:LAST_RESPONSE]->(last)
    DELETE lrel

    // Link the previous last response to the new response (if last exists)
    CREATE (last)-[:NEXT]->(response)
  }

  // Create a new LAST_RESPONSE relationship from session to the new response
  CREATE (session)-[:LAST_RESPONSE]->(response)

  // Subquery to link response to context nodes
  WITH response
  CALL {
    WITH response
    // For each context node ID in $ids
    UNWIND $ids AS id
    // Find the context node by its elementId
    MATCH (context)
    WHERE elementId(context) = id
    // Link the response to the context node
    CREATE (response)-[:CONTEXT]->(context)

    RETURN count(*) AS count
  }

  // Return the ID of the newly created response node
  RETURN DISTINCT response.id AS id
`,
    {
      sessionId,
      source,
      input,
      output,
      rephrasedQuestion,
      cypher: cypher,
      ids
    },
    'WRITE'
  );
  return res && res.length ? res[0].id : '';
}
// end::save[]
