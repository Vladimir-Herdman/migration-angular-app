import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';

@Component({
    selector: 'app-tab_chatbot',
    templateUrl: 'tab_chatbot.page.html',
    styleUrls: ['tab_chatbot.page.scss'],
    standalone: false,
})
export class TabChatBotPage implements OnInit {
    @ViewChild('messages_area', { static: false }) messages_area!: ElementRef;
    message: string = "";
    isLoading: boolean = false;

    constructor() {}

    ngOnInit() {
    }

    /**
     * This method here takes the text from the message box and makes it an
     * html <p> tag to display on screen.  It then sends that text to the
     * getMessage function to get a response from the AI model.
     */
    sendMessage() {
        if (!this.message.trim()) return;

        const html = `<p class="message user-side">${this.escapeHTML(this.message)}</p>`

        // Display user message on screen
        if (this.messages_area && this.messages_area.nativeElement) {
            this.messages_area.nativeElement.insertAdjacentHTML('beforeend', html);
            this.scrollToBottom();

                const lastMessage = document.querySelector(".user-side:last-child") as HTMLElement | null;
            setTimeout(() => {
                lastMessage?.classList.add("appear", "shake");
            }, 10)

            setTimeout(() => {
                lastMessage?.classList.remove("shake");
                void lastMessage?.offsetWidth;
            }, 600)
        }

        // Get AI response and display on screen
        this.isLoading = true;
        this.getMessage(this.message).then(bot_message => {
            if (this.messages_area && this.messages_area.nativeElement) {
                this.messages_area.nativeElement.insertAdjacentHTML('beforeend', bot_message);
                this.scrollToBottom();

                const lastMessage = document.querySelector(".bot-side:last-child") as HTMLElement | null;
                setTimeout(() => {
                    lastMessage?.classList.add("appear", "shake");
                }, 10)

                setTimeout(() => {
                    lastMessage?.classList.remove("shake");
                    void lastMessage?.offsetWidth;
                }, 600)
            }
            this.isLoading = false;
        });

        this.message = "";
    }

    /**
     * This method is made as a promise as I don't know how long the AI
     * will take to respond to the sent message, so it's kept asynchronous
     * to only show AI response on finished reply
     */
    async getMessage(question: string): Promise<string> {
        return new Promise((resolve, reject) => {
            //REMOVE: The setTimeout here is to be an example of the AI
            //response taking a while to run

            //TODO: Use question above to send call to AI to get response and
            //services recommended potentioally
            setTimeout(() => {
                const example_text: string = "Good question, let me get back to you on that!"; //REMOVE
                const html = `<p class="message bot-side">${this.escapeHTML(example_text)}</p>`

                resolve(html)
            }, 1000);
        });
    }

    /**
     * This method is called when the user sends text (and on what the AI
     * returns) to clean extra html tags from it, essentially a protection
     * from any malicious code that could go in the message area
     */
    escapeHTML(text: string): string {
        const div = document.createElement("div");
        div.innerText = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const content = document.querySelector("ion-content");
        if (content && this.messages_area && this.messages_area.nativeElement) {
            setTimeout(() => {
                this.messages_area.nativeElement.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 200);
        }
    }
}
