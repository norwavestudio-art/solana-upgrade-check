import { getFavoriteDomain } from "@bonfida/spl-name-service";

export async function Profile({ connection, wallet }: any) {
  const { reverse } = await getFavoriteDomain(connection, wallet);
  return <span>{`${reverse}.sol`}</span>;
}
