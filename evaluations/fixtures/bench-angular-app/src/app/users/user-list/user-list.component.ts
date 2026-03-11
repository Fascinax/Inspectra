import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  avatar: string;
}

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery = '';
  page = 1;
  pageSize = 10;
  totalPages = 1;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.filteredUsers = users;
      this.totalPages = Math.ceil(users.length / this.pageSize);
    });
  }

  onSearch(): void {
    this.filteredUsers = this.users.filter(u =>
      u.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    this.page = 1;
    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize);
  }

  editUser(user: User): void {
    // TODO: implement edit modal
    console.log('edit', user);
  }

  deleteUser(user: User): void {
    // FIXME: add confirmation dialog before deleting
    this.userService.deleteUser(user.id).subscribe(() => this.loadUsers());
  }

  prevPage(): void {
    if (this.page > 1) this.page--;
  }

  nextPage(): void {
    if (this.page < this.totalPages) this.page++;
  }
}
