export async function sleep(delay = 0) {
  await new Promise(resolve => setTimeout(resolve, delay));
}