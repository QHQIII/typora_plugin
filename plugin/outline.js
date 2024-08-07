class outlinePlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    html = () => {
        const [className, hint] = this.config.SHOW_HIDDEN ? ["ion-eye", "显示被其他插件隐藏的元素"] : ["ion-eye-disabled", "不显示被其他插件隐藏的元素"];
        return `
            <div id="plugin-outline" class="plugin-common-modal plugin-common-hidden">
                <div class="plugin-outline-header">
                    <div class="plugin-outline-icon ${className}" type="eye" ty-hint="${hint}"></div>
                    <div class="plugin-outline-icon ion-arrow-move" type="move" ty-hint="移动"></div>
                    <div class="plugin-outline-icon ion-close" type="close" ty-hint="关闭"></div>
                </div>
                <div class="plugin-outline-list"></div>
                <div class="plugin-outline-footer">
                    <div class="plugin-outline-icon ion-code" type="fence" ty-hint="代码块"></div>
                    <div class="plugin-outline-icon ion-image" type="image" ty-hint="图片"></div>
                    <div class="plugin-outline-icon ion-grid" type="table" ty-hint="表格"></div>
                    ${this.config.USE_ALL ? '<div class="plugin-outline-icon ion-android-data" type="all" ty-hint="混合"></div>' : ""}
                </div>
            </div>
        `
    }

    init = () => {
        this.entities = {
            modal: document.getElementById("plugin-outline"),
            header: document.querySelector("#plugin-outline .plugin-outline-header"),
            list: document.querySelector("#plugin-outline .plugin-outline-list"),
            footer: document.querySelector("#plugin-outline .plugin-outline-footer"),
            move: document.querySelector(`#plugin-outline .plugin-outline-icon[Type="move"]`),
        }
        this.collectUtil = new _collectUtil(this.config, this.entities);
    }

    process = () => {
        this.utils.dragFixedModal(this.entities.move, this.entities.modal, false);

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, this.update);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, () => this.config.AUTO_REFRESH_WHEN_OPEN_FILE && setTimeout(this.update, 300));
        // 旧版本的Typora的outlineUpdated事件很难触发
        if (this.utils.isBetaVersion) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.utils.throttle(this.update, 300));
        }

        this.entities.modal.addEventListener("click", ev => {
            const item = ev.target.closest(".plugin-outline-item");
            const headerIcon = ev.target.closest(".plugin-outline-header .plugin-outline-icon");
            const footerIcon = ev.target.closest(".plugin-outline-footer .plugin-outline-icon");

            if (!item && !headerIcon && !footerIcon) return;

            ev.stopPropagation();
            ev.preventDefault();

            if (item) {
                const cid = item.querySelector("span").getAttribute("data-ref");
                this.utils.scrollByCid(cid);
            } else if (footerIcon) {
                const Type = footerIcon.getAttribute("type");
                this.collectAndShow(Type);
            } else {
                const Type = headerIcon.getAttribute("type");
                if (Type === "close") {
                    this.hide();
                } else if (Type === "eye") {
                    this.toggleEye(headerIcon);
                    this.refresh();
                }
            }
        })
    }

    update = () => this.utils.isShow(this.entities.modal) && this.refresh()

    collectAndShow = Type => {
        this.setFooterActive(Type);
        this.collectUtil.collect();
        this.collectUtil.bindDOM(Type);
        this.utils.show(this.entities.modal);
    }

    setFooterActive = Type => {
        for (let ele = this.entities.footer.firstElementChild; !!ele; ele = ele.nextElementSibling) {
            const force = ele.getAttribute("type") === Type;
            ele.classList.toggle("select", force);
        }
    }

    refresh = () => {
        if (this.utils.isShow(this.entities.modal)) {
            const search = this.entities.footer.querySelector(".plugin-outline-icon.select");
            this.collectAndShow(search.getAttribute("Type"));
        }
    }

    toggleEye = icon => {
        this.config.SHOW_HIDDEN = !this.config.SHOW_HIDDEN;
        const eye = icon.classList.contains("ion-eye");
        const hint = (eye ? "不" : "") + "显示被其他插件隐藏的元素";
        icon.setAttribute("ty-hint", hint);
        icon.classList.toggle("ion-eye");
        icon.classList.toggle("ion-eye-disabled");
    }

    call = () => {
        if (this.utils.isShow(this.entities.modal)) {
            this.hide();
        } else {
            this.collectAndShow(this.config.DEFAULT_TYPE);
        }
    };

    hide = () => this.utils.hide(this.entities.modal);
}

class _collectUtil {
    constructor(config, entities) {
        this.config = config;
        this.entities = entities;

        this.paragraphIdx = 0;
        this.tableIdx = 0;
        this.imageIdx = 0;
        this.fenceIdx = 0;
        this.collection = { table: [], image: [], fence: [] };
    }

    clear() {
        this.paragraphIdx = this.tableIdx = this.imageIdx = this.fenceIdx = 0;
        this.collection = { table: [], image: [], fence: [] };
    }

    collect() {
        this.clear();
        const elements = document.querySelectorAll("#write>h1, #write>h2, .md-table, .md-fences, .md-image");
        elements.forEach(ele => {
            if (!this.config.SHOW_HIDDEN && ele.style.display === "none") return;

            const tagName = ele.tagName;
            if (tagName === "H1") {
                this.paragraphIdx = 0;
                this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                return;
            } else if (tagName === "H2") {
                this.paragraphIdx++;
                this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                return;
            }

            const cid = ele.closest("[cid]").getAttribute("cid");
            // table
            if (ele.classList.contains("md-table")) {
                this.tableIdx++;
                const collection = { cid: cid, type: "table", paragraphIdx: this.paragraphIdx, idx: this.tableIdx };
                this.collection.table.push(collection);
                // fence
            } else if (ele.classList.contains("md-fences")) {
                this.fenceIdx++;
                const collection = { cid: cid, type: "fence", paragraphIdx: this.paragraphIdx, idx: this.fenceIdx };
                this.collection.fence.push(collection);
                // image
            } else if (ele.classList.contains("md-image")) {
                this.imageIdx++;
                const collection = { cid: cid, type: "image", paragraphIdx: this.paragraphIdx, idx: this.imageIdx };
                this.collection.image.push(collection);
            }
        })
    }

    compare(p) {
        return function (m, n) {
            const cid1 = parseInt(m[p].replace("n", ""));
            const cid2 = parseInt(n[p].replace("n", ""));
            return cid1 - cid2;
        }
    }

    getCollection(Type) {
        if (Type !== "all") {
            return this.collection[Type]
        }
        let list = [];
        for (const collect of Object.values(this.collection)) {
            list.push(...collect);
        }
        list.sort(this.compare("cid"));
        return list
    }

    setColor(ele, item, type) {
        if (type === "all") {
            const { fence, image, table } = this.config.COLOR;
            if (item.type === "table") {
                ele.style.backgroundColor = table;
            } else if (item.type === "fence") {
                ele.style.backgroundColor = fence;
            } else if (item.type === "image") {
                ele.style.backgroundColor = image;
            }
        } else {
            ele.style.backgroundColor = "";
        }
    }

    // 简易数据单向绑定
    bindDOM(Type) {
        const typeCollection = this.getCollection(Type);

        const first = this.entities.list.firstElementChild;
        if (first && !first.classList.contains("plugin-outline-item")) {
            this.entities.list.removeChild(first);
        }

        while (typeCollection.length !== this.entities.list.childElementCount) {
            if (typeCollection.length > this.entities.list.childElementCount) {
                const div = document.createElement("div");
                div.classList.add("plugin-outline-item");
                div.appendChild(document.createElement("span"));
                this.entities.list.appendChild(div);
            } else {
                this.entities.list.removeChild(this.entities.list.firstElementChild);
            }
        }

        if (this.entities.list.childElementCount === 0) {
            const div = document.createElement("div");
            div.classList.add("plugin-outline-empty");
            div.innerText = "Empty";
            this.entities.list.appendChild(div);
            return
        }

        let ele = this.entities.list.firstElementChild;
        typeCollection.forEach(item => {
            if (this.config.SET_COLOR_IN_ALL) {
                this.setColor(ele, item, Type);
            }
            const span = ele.firstElementChild;
            span.setAttribute("data-ref", item.cid);
            span.innerText = `${this.config.SHOW_NAME[item.type]} ${item.paragraphIdx}-${item.idx}`;
            ele = ele.nextElementSibling;
        })
    }
}

module.exports = {
    plugin: outlinePlugin
};

