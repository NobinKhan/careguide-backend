interface UserDTO {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  interests: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface AuthorSummaryDTO {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

interface NoteDTO {
  _id: string;
  userId: string;
  author?: AuthorSummaryDTO | null;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PostDTO {
  _id: string;
  userId: string;
  author?: AuthorSummaryDTO | null;
  title: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuthResponseDTO {
  token: string;
  user: UserDTO;
}

interface DeleteUserResponseDTO {
  deletedUserId: string;
  keepData: boolean;
  deletedNotesCount: number;
  deletedPostsCount: number;
}

interface InterestGroupUserDTO {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

interface InterestGroupDTO {
  interest: string;
  totalUsers: number;
  users: InterestGroupUserDTO[];
}

interface UserWithPostsDTO extends UserDTO {
  posts: PostDTO[];
}

interface UserPostsAggregationResponseDTO {
  user: UserWithPostsDTO;
  page: number;
  limit: number;
}
