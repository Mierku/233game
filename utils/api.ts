// http://localhost:1337/api/list?populate[0]=author.avatar&populate[1]=categories&populate[2]=cover
const baseURL = "https://bright-reward-e6526194c7.strapiapp.com/api";
interface ListResponse {
	type: "image" | "video";
	title: string;
	desc: string;
	author: {
		name: string;
		avatar: { url: string };
	};
	like: number;
	cover: { url: string; width: number; height: number };
	video?: { url: string };
	categories: { name: string }[];
}
export function getList<T>(
	{
		start = 1,
		limit = 3,
		category,
		like,
	}: {
		start?: number;
		limit?: number;
		category?: string | null;
		like?: string | null;
	},
	async = false
) {
	let options;
	let query = {
		"populate[0]": "author.avatar",
		"populate[1]": "categories",
		"populate[2]": "cover",
		"populate[3]": "video",
		"pagination[page]": start,
		"pagination[pageSize]": limit,
	};
	if (category) {
		query = { ...query, "filters[categories][name][$eq]": category };
	}
	if (like) {
		query = { ...query, "sort[0]": `like:${like}` };
	}

	if (async) {
		return useFetch<{ data: ListResponse[] }>("/list", {
			baseURL,
			method: "GET",
			query,
		});
	} else {
		return $fetch<ListResponse>("/list", {
			baseURL,
			method: "GET",
			query,
		});
	}
	// }
}
