import AppKit
import SwiftUI

@main
struct LinkedInAISlopApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("LinkedIn AI Slop")
                .font(.title2)
            Text("Włącz rozszerzenie w Safari: Ustawienia → Rozszerzenia → LinkedIn AI Slop. Zezwól na www.linkedin.com. Potem otwórz feed.")
                .fixedSize(horizontal: false, vertical: true)
            Text("Enable the extension in Safari Settings → Extensions, allow www.linkedin.com, then open the feed.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Otwórz ustawienia rozszerzeń Safari") {
                let url = URL(string: "x-apple.systempreferences:com.apple.ExtensionsPreferences?extensionPointIdentifier=com.apple.Safari.extension")!
                NSWorkspace.shared.open(url)
            }
        }
        .padding(24)
        .frame(width: 460)
    }
}
