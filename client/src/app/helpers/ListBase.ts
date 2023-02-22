import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';

export class ListBase<TItem> {
  loading = false;
  items: TItem[] = [];
  filteredItems: TItem[] = [];
  pagedItems: TItem[] = [];
  viewCount!: number;
  orderProp = '';
  query = '';
  exactQuery!: string;

  constructor(
    protected route: ActivatedRoute,
    protected alertService: AlertService,
    protected spinner: NgxSpinnerService
  ) {}

  parseQueryParam() {
    if (this.route.snapshot.queryParamMap.has('query')) {
      this.query = this.route.snapshot.queryParamMap.get('query') as string;
      this.exactQuery = this.query;
    }
  }

  setItems(items) {
    this.items = items;
    this.updateList();
    this.viewCount = Math.min(100, this.filteredItems.length);
    this.pagedItems = this.filteredItems.slice(0, this.viewCount);
  }

  handleError(error) {
    if (error && error.data && error.data.error == 'unauthorized') {
      window.location.href = '/login';
      return;
    }

    let message = 'unknown error';
    if (typeof error === 'string') {
      message = error;
    } else if (error && error.message) {
      message = error.message;
    } else if (error && error.data) {
      message = error.data;
    }

    this.alertService.error(message);
  }

  filter(query) {
    const self = this;
    return function (value) {
      if (query == '') {
        return true;
      } else {
        const result = self.filterItem(value, query);
        if (result) {
          return result.value;
        } else {
          return false;
        }
      }
    };
  }

  filterItem(value, query): { value: boolean } | undefined {
    return undefined;
  }

  onQueryChanged() {
    this.updateList();
  }

  onOrderChanged() {
    this.updateList();
  }

  loadMore() {
    if (this.loading == false && this.viewCount < this.filteredItems.length) {
      this.viewCount = Math.min(this.viewCount + 50, this.filteredItems.length);
      this.pagedItems = this.filteredItems.slice(0, this.viewCount);
    }
  }

  getValue(obj, path) {
    const pathArray = path.split('.');
    const len = pathArray.length;
    for (let i = 0; i < len; i++) {
      obj = obj[pathArray[i]];
    }
    return obj;
  }

  getId(item) {
    return item.ID;
  }

  updateList() {
    const self = this;
    self.filteredItems = self.items.filter((item) =>
      self.filter(self.query)(item)
    );
    self.filteredItems.sort(function (a, b) {
      if (self.orderProp.indexOf('-') == 0) {
        const va = self.getValue(a, self.orderProp.substr(1));
        const vb = self.getValue(b, self.orderProp.substr(1));
        if (va == vb) {
          return self.getId(a) <= self.getId(b) ? 1 : -1;
        }
        return va <= vb ? 1 : -1;
      } else {
        const va = self.getValue(a, self.orderProp);
        const vb = self.getValue(b, self.orderProp);
        if (va == vb) {
          return self.getId(a) > self.getId(b) ? 1 : -1;
        }
        return va > vb ? 1 : -1;
      }
    });
    self.viewCount = Math.min(this.viewCount + 50, 50);
    self.pagedItems = self.filteredItems.slice(0, self.viewCount);
  }
}
