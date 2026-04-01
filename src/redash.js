export const fetchQueryResults = async (id, baseUrl) => {
  const response = await fetch(`${baseUrl}/api/queries/${id}/results`, {
    headers: {
      Authorization: `Key ${process.env.REDASH_USER_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`failed to fetch the query results for ${id}`);
  }

  const results = await response.json();

  return (results?.query_result?.data?.rows ?? []).slice(
    0,
    process.env.MAX_RESULTS_TO_PROCESS,
  );
};
