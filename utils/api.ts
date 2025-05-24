// http://localhost:1337/api/list?populate[0]=author.avatar&populate[1]=categories&populate[2]=cover
interface ListResponse {
	type: "image" | "video";
	title: string;
	desc: string;
	author: {
		name: string;
		avatar: { url: string };
	};
	like: number;
	cover: { url: string };
	video?: { url: string };
	categories: { name: string }[];
}
export function getList({ start = 1, limit = 3, category = undefined }) {
	let options;
	let query = {
		"populate[0]": "author.avatar",
		"populate[1]": "categories",
		"populate[2]": "cover",
		"pagination[page]": start,
		"pagination[pageSize]": limit,
	};
	if (category) {
		query = { ...query, "filters[categories][name][$eq]": category };
	}
	// if (import.meta.client) {
	// 	console.log("client");
	// 	return $fetch<{ data: ListResponse[] }>("http://localhost:1337/api/list", {
	// 		method: "GET",
	// 		query,
	// 	});
	// } else {
	console.log("server");
	return useFetch<{ data: ListResponse[] }>(
		"https://bright-reward-e6526194c7.strapiapp.com/api/list",
		{
			method: "GET",
			query,
		}
	);
	// }
}
