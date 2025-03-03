class notification {
    constructor(utils) {
        this.utils = utils;
        this.timer = null;
        this.types = {
            success: { bgColor: "#e6ffed", iconColor: "#009688", icon: "fa fa-check" },
            info: { bgColor: "#e6f7ff", iconColor: "#448aff", icon: "fa fa-info-circle" },
            warning: { bgColor: "#fffbe6", iconColor: "#f57c00", icon: "fa fa-warning" },
            error: { bgColor: "#ffe6e6", iconColor: "#d32f2f", icon: "fa fa-bug" },
        }
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-notification");
        this.utils.insertElement(`
            <div class="plugin-common-notification plugin-common-hidden">
                <span class="notification-icon fa fa-check"></span>
                <span class="notification-message"></span>
                <button class="notification-close-btn">✕</button>
            </div>
        `);
        document.querySelector(".plugin-common-notification .notification-close-btn").addEventListener("click", () => this.hide());
    }

    getNotification = () => document.querySelector(".plugin-common-notification")

    hide = () => this.utils.hide(this.getNotification())

    show = (message, type = "success", last = 3000) => {
        clearTimeout(this.timer)
        if (!this.types.hasOwnProperty(type)) {
            type = "info"
        }
        const { bgColor, iconColor, icon } = this.types[type]
        const notification = this.getNotification()
        notification.querySelector(".notification-message").textContent = message
        notification.querySelector(".notification-icon").className = `notification-icon ${icon}`
        notification.style.setProperty("--notification-bg-color", bgColor)
        notification.style.setProperty("--notification-icon-color", iconColor)
        this.utils.show(notification)
        if (last > 0) {
            this.timer = setTimeout(() => this.hide(), last)
        }
    }
}

module.exports = {
    notification
}
